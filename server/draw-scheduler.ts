import * as cron from 'node-cron';
import { storage } from './database-storage';
import { vrfService } from './vrf';
import { blockchainService } from './blockchain';
import { winnerService } from './winner-service';
import { systemSettingsService } from './system-settings-service';

interface DrawState {
  isDrawInProgress: boolean;
  drawType: 'daily' | 'weekly' | null;
  drawStartTime: Date | null;
  drawId: number | null;
}

/**
 * Automated Draw Scheduler Service
 * Handles scheduled lottery draws and purchase restrictions
 */
export class DrawSchedulerService {
  private static instance: DrawSchedulerService;
  private drawState: DrawState = {
    isDrawInProgress: false,
    drawType: null,
    drawStartTime: null,
    drawId: null
  };

  private constructor() {
    this.initializeScheduler();
    this.ensureUpcomingDraws();
  }

  public static getInstance(): DrawSchedulerService {
    if (!DrawSchedulerService.instance) {
      DrawSchedulerService.instance = new DrawSchedulerService();
    }
    return DrawSchedulerService.instance;
  }

  private async initializeScheduler(): Promise<void> {
    // Get settings from database
    const settings = await systemSettingsService.getDrawSettings();
    
    if (settings.autoDrawsEnabled) {
      // Parse daily draw time (convert CAT to UTC by subtracting 2 hours)
      const [dailyHourCAT, dailyMinute] = settings.dailyDrawTime.split(':').map(Number);
      const dailyHour = (dailyHourCAT - 2 + 24) % 24; // Convert CAT to UTC
      
      // Parse weekly draw time (convert CAT to UTC by subtracting 2 hours)
      const [weeklyHourCAT, weeklyMinute] = settings.weeklyDrawTime.split(':').map(Number);
      const weeklyHour = (weeklyHourCAT - 2 + 24) % 24; // Convert CAT to UTC
      
      // Get draw days as numbers (0=Sunday, 1=Monday, etc.)
      let drawDaysArray: string[];
      try {
        if (typeof settings.drawDays === 'string') {
          // Try to parse as JSON first
          try {
            drawDaysArray = JSON.parse(settings.drawDays);
          } catch {
            // If JSON parse fails, treat as comma-separated string
            drawDaysArray = settings.drawDays.split(',').map(d => d.trim());
          }
        } else {
          drawDaysArray = settings.drawDays;
        }
      } catch (error) {
        console.warn('Error parsing draw days, using default:', error);
        drawDaysArray = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      }
      
      const drawDayNumbers = drawDaysArray.map(day => {
        const dayMap: Record<string, number> = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
          'thursday': 4, 'friday': 5, 'saturday': 6
        };
        return dayMap[day.toLowerCase()];
      }).filter(num => num !== undefined).join(',');
      
      const weeklyDayNumber = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      }[settings.weeklyDrawDay.toLowerCase()];

      // Schedule daily draws
      const dailyCron = `${dailyMinute} ${dailyHour} * * ${drawDayNumbers}`;
      cron.schedule(dailyCron, async () => {
        console.log('🎰 Scheduled daily draw starting - using database settings');
        await this.executeScheduledDraw('daily');
      });

      // Schedule weekly draws
      const weeklyCron = `${weeklyMinute} ${weeklyHour} * * ${weeklyDayNumber}`;
      cron.schedule(weeklyCron, async () => {
        console.log('🎰 Scheduled weekly draw starting - using database settings');
        await this.executeScheduledDraw('weekly');
      });

      console.log(`⏰ Draw scheduler initialized - Daily draws at ${settings.dailyDrawTime} CAT ${drawDaysArray.join(', ')}, Weekly draws at ${settings.weeklyDrawTime} CAT ${settings.weeklyDrawDay} (database configurable)`);
    } else {
      console.log('⏸️ Draw scheduler disabled - Auto draws turned off in database settings');
    }
  }

  /**
   * Execute scheduled draw using admin dashboard settings
   */
  private async executeScheduledDraw(type: 'daily' | 'weekly'): Promise<void> {
    try {
      console.log(`🎯 Starting scheduled ${type} draw with admin settings...`);
      
      // Set draw in progress state
      this.drawState = {
        isDrawInProgress: true,
        drawType: type,
        drawStartTime: new Date(),
        drawId: null
      };

      // Check if there's already an upcoming draw of this type
      const existingDraw = await storage.getUpcomingDraw(type);
      if (!existingDraw) {
        // Get default jackpot from database settings
        const settings = await systemSettingsService.getDrawSettings();
        const defaultJackpot = type === 'daily' ? 
          settings.dailyDefaultJackpot.toString() + '.00' : 
          settings.weeklyDefaultJackpot.toString() + '.00';
        
        console.log(`📅 Creating new ${type} draw with jackpot: $${defaultJackpot} (from database settings)`);
        const drawDate = new Date();
        
        const newDraw = await storage.createDraw({
          type,
          jackpotAmount: defaultJackpot,
          drawDate,
          winningNumbers: [1, 2, 3, 4, 5, 6], // Placeholder, will be replaced
          isComplete: false,
          totalTickets: 0,
          blockchainHash: `scheduled-${Date.now()}`
        });
        
        this.drawState.drawId = newDraw.id;
        console.log(`✅ Created ${type} draw ${newDraw.id} - executing immediately`);
        
        // Execute the draw immediately
        await this.executeDraw(type);
      } else {
        // Execute existing draw
        this.drawState.drawId = existingDraw.id;
        await this.executeDraw(type);
      }
      
    } catch (error) {
      console.error(`❌ Error in scheduled ${type} draw:`, error);
      this.resetDrawState();
    }
  }

  /**
   * Execute automated draw
   */
  private async executeDraw(type: 'daily' | 'weekly'): Promise<void> {
    try {
      console.log(`🎯 Starting automated ${type} draw...`);
      
      // Set draw in progress state
      this.drawState = {
        isDrawInProgress: true,
        drawType: type,
        drawStartTime: new Date(),
        drawId: null
      };

      // Get current draw
      const currentDraw = await storage.getUpcomingDraw(type);
      if (!currentDraw) {
        console.log(`❌ No upcoming ${type} draw found`);
        this.resetDrawState();
        return;
      }

      this.drawState.drawId = currentDraw.id;

      // Get all tickets for this draw
      const tickets = await storage.getTicketsByDraw(currentDraw.id);
      console.log(`📊 Processing ${tickets.length} tickets for draw ${currentDraw.id}`);

      // Generate winning numbers using VRF
      const numberOfNumbers = type === 'daily' ? 5 : 6;
      const maxNumber = type === 'daily' ? 45 : 49;
      
      const vrfResult = await vrfService.generateDrawNumbers(currentDraw.id, type);
      const winningNumbers = this.generateNumbersFromSeed(vrfResult.randomValue, numberOfNumbers, maxNumber);

      console.log(`🎲 Winning numbers generated: ${winningNumbers.join(', ')}`);

      // Record on blockchain for transparency
      const blockchainHash = await blockchainService.recordDrawResult(
        currentDraw.id,
        type,
        winningNumbers
      );

      // Complete the draw
      const completedDraw = await storage.completeDraw(
        currentDraw.id,
        winningNumbers,
        blockchainHash
      );

      // Process winners
      await winnerService.processDrawWinners(currentDraw.id);

      // Create next draw
      await this.createNextDraw(type);

      const drawDuration = Date.now() - this.drawState.drawStartTime!.getTime();
      console.log(`✅ ${type} draw completed in ${drawDuration}ms (${(drawDuration/1000).toFixed(2)}s)`);

      if (drawDuration > 60000) {
        console.warn(`⚠️ Draw took longer than 1 minute: ${(drawDuration/1000).toFixed(2)}s`);
      }

    } catch (error) {
      console.error(`❌ Error during automated ${type} draw:`, error);
    } finally {
      // Always reset draw state
      this.resetDrawState();
    }
  }

  /**
   * Generate lottery numbers from VRF seed
   */
  private generateNumbersFromSeed(seed: string, count: number, maxNumber: number): number[] {
    const numbers: number[] = [];
    let currentSeed = seed;

    while (numbers.length < count) {
      // Hash the seed to get next random value
      const hash = this.hashSeed(currentSeed);
      const num = (parseInt(hash.substring(0, 8), 16) % maxNumber) + 1;
      
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
      
      currentSeed = hash;
    }

    return numbers.sort((a, b) => a - b);
  }

  /**
   * Hash seed for next random value
   */
  private hashSeed(seed: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Ensure upcoming draws exist when system starts
   */
  private async ensureUpcomingDraws(): Promise<void> {
    try {
      const upcomingDraws = await storage.getUpcomingDraws();
      
      // Check if we need to create daily draw
      if (!upcomingDraws.daily) {
        await this.createNextDraw('daily');
        console.log('📅 Created missing daily upcoming draw');
      }
      
      // Check if we need to create weekly draw
      if (!upcomingDraws.weekly) {
        await this.createNextDraw('weekly');
        console.log('📅 Created missing weekly upcoming draw');
      }
      
    } catch (error) {
      console.error('Error ensuring upcoming draws:', error);
    }
  }

  /**
   * Create next draw after completion
   */
  private async createNextDraw(type: 'daily' | 'weekly'): Promise<void> {
    try {
      const now = new Date();
      let nextDrawDate: Date;

      if (type === 'daily') {
        // Get draw time from database settings
        const settings = await systemSettingsService.getDrawSettings();
        const [hour, minute] = settings.dailyDrawTime.split(':').map(Number);
        
        // Create date for today's draw time in CAT
        const todayDrawTime = new Date(now);
        todayDrawTime.setHours(hour, minute, 0, 0);
        
        // If today's draw time hasn't passed and it's a weekday, schedule for today
        if (now < todayDrawTime && now.getDay() >= 1 && now.getDay() <= 5) {
          nextDrawDate = todayDrawTime;
        } else {
          // Otherwise, schedule for next weekday
          nextDrawDate = new Date(now);
          nextDrawDate.setDate(now.getDate() + 1);
          nextDrawDate.setHours(hour, minute, 0, 0);
          
          // Skip weekends
          while (nextDrawDate.getDay() === 0 || nextDrawDate.getDay() === 6) {
            nextDrawDate.setDate(nextDrawDate.getDate() + 1);
          }
        }
      } else {
        // Get draw time from database settings
        const settings = await systemSettingsService.getDrawSettings();
        const [hour, minute] = settings.weeklyDrawTime.split(':').map(Number);
        
        // Next Sunday at the configured time in CAT
        nextDrawDate = new Date(now);
        const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
        nextDrawDate.setDate(now.getDate() + daysUntilSunday);
        
        // Set time in CAT (store as CAT time, not UTC)
        nextDrawDate.setHours(hour, minute, 0, 0);
      }

      // Get default jackpot from database settings
      const settings = await systemSettingsService.getDrawSettings();
      const jackpotAmount = type === 'daily' ? 
        settings.dailyDefaultJackpot.toString() + '.00' : 
        settings.weeklyDefaultJackpot.toString() + '.00';

      await storage.createDraw({
        type,
        drawDate: nextDrawDate,
        jackpotAmount,
        winningNumbers: [],
        totalTickets: 0,
        isComplete: false
      });

      console.log(`📅 Next ${type} draw scheduled for ${nextDrawDate.toLocaleString()}`);
    } catch (error) {
      console.error(`Error creating next ${type} draw:`, error);
    }
  }

  /**
   * Reset draw state
   */
  private resetDrawState(): void {
    this.drawState = {
      isDrawInProgress: false,
      drawType: null,
      drawStartTime: null,
      drawId: null
    };
  }

  /**
   * Check if ticket purchases are allowed
   */
  public canPurchaseTickets(): { allowed: boolean; reason?: string } {
    if (this.drawState.isDrawInProgress) {
      const duration = this.drawState.drawStartTime ? 
        Date.now() - this.drawState.drawStartTime.getTime() : 0;
      
      return {
        allowed: false,
        reason: `${this.drawState.drawType} draw in progress (${Math.round(duration/1000)}s elapsed)`
      };
    }

    return { allowed: true };
  }

  /**
   * Get current draw state
   */
  public getDrawState(): DrawState {
    return { ...this.drawState };
  }

  /**
   * Force execute draw (for manual testing)
   */
  public async forceExecuteDraw(type: 'daily' | 'weekly'): Promise<void> {
    console.log(`🔧 Manual execution of ${type} draw requested`);
    await this.executeDraw(type);
  }

  /**
   * Emergency stop - halt all draws
   */
  public emergencyStop(): void {
    console.log('🚨 EMERGENCY STOP - All draws halted');
    this.resetDrawState();
    // Note: This doesn't stop cron jobs, just prevents new draws
  }
}

export const drawScheduler = DrawSchedulerService.getInstance();