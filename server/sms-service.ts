import { storage } from "./storage";
import { ecocashService } from "./ecocash";
import { generateQuickPickNumbers } from "@shared/utils";

/**
 * SMS Service for Mutapa Lottery
 * Provides SMS fallback functionality for USSD operations
 * Supports shortcodes for key actions
 */

export interface SMSCommand {
  code: string;
  description: string;
  handler: (phoneNumber: string, params: string[]) => Promise<string>;
}

export interface SMSSession {
  phoneNumber: string;
  pendingAction?: string;
  pendingData?: any;
  createdAt: Date;
  expiresAt: Date;
}

export class SMSService {
  private static instance: SMSService;
  private sessions: Map<string, SMSSession> = new Map();
  private readonly SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    setInterval(() => this.cleanupSessions(), 60000);
  }

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  private cleanupSessions(): void {
    const now = new Date();
    for (const [phone, session] of this.sessions.entries()) {
      if (now.getTime() > session.expiresAt.getTime()) {
        this.sessions.delete(phone);
      }
    }
  }

  private createSession(phoneNumber: string, action?: string, data?: any): SMSSession {
    const now = new Date();
    const session: SMSSession = {
      phoneNumber,
      pendingAction: action,
      pendingData: data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.SESSION_TIMEOUT)
    };
    this.sessions.set(phoneNumber, session);
    return session;
  }

  private getSession(phoneNumber: string): SMSSession | undefined {
    return this.sessions.get(phoneNumber);
  }

  // SMS Shortcode Commands
  private commands: Record<string, SMSCommand> = {
    HELP: {
      code: 'HELP',
      description: 'Show available SMS commands',
      handler: async (phoneNumber: string) => {
        return `Mutapa Lottery SMS Commands:
REG - Register new account
BAL - Check balance
DAILY - Buy daily ticket ($0.50)
WEEKLY - Buy weekly ticket ($1.00)
RESULT - View latest results
KYC - Complete identity verification
STOP - Stop all SMS notifications

Text commands to ${this.getShortcode()}`;
      }
    },

    REG: {
      code: 'REG',
      description: 'Register new account',
      handler: async (phoneNumber: string, params: string[]) => {
        try {
          const existingUser = await storage.getUserByPhone(phoneNumber);
          if (existingUser) {
            return `Account already exists for ${phoneNumber}. Text BAL to check balance or HELP for commands.`;
          }

          // Create new user account
          const user = await storage.registerUser({
            phoneNumber,
            password: Math.random().toString(36).substring(2, 15), // Generate random password
            isAgent: false
          });

          // Send KYC verification link
          const kycLink = `https://mutapa-lottery.replit.app/verify-identity?phone=${encodeURIComponent(phoneNumber)}`;
          
          return `Welcome to Mutapa Lottery! Account created for ${phoneNumber}.

Complete identity verification: ${kycLink}

Or text KYC for verification steps.

Text HELP for commands.`;

        } catch (error) {
          if (error instanceof Error && error.message.includes("already exists")) {
            return `Account already exists for ${phoneNumber}. Text BAL to check balance or HELP for commands.`;
          }
          return `Registration failed. Please try again or contact support.`;
        }
      }
    },

    BAL: {
      code: 'BAL',
      description: 'Check account balance',
      handler: async (phoneNumber: string) => {
        try {
          const user = await storage.getUserByPhone(phoneNumber);
          if (!user) {
            return `No account found. Text REG to register.`;
          }

          return `Balance: $${user.balance}
${user.kycStatus === 'approved' ? 'KYC: Verified ✓' : 'KYC: Pending - Text KYC to verify'}

Text DAILY or WEEKLY to buy tickets.`;
        } catch (error) {
          return `Unable to check balance. Please try again.`;
        }
      }
    },

    DAILY: {
      code: 'DAILY',
      description: 'Buy daily lottery ticket',
      handler: async (phoneNumber: string, params: string[]) => {
        try {
          const user = await storage.getUserByPhone(phoneNumber);
          if (!user) {
            return `No account found. Text REG to register.`;
          }

          if (user.kycStatus !== 'approved') {
            return `Identity verification required. Text KYC to complete verification.`;
          }

          if (parseFloat(user.balance) < 0.50) {
            return `Insufficient balance. Current: $${user.balance}. Need: $0.50. Add funds via EcoCash or agent.`;
          }

          // Check if numbers provided in SMS
          let numbers: number[] = [];
          if (params.length > 0) {
            try {
              numbers = params[0].split(',').map(n => parseInt(n.trim()));
              if (numbers.length !== 5 || numbers.some(n => n < 1 || n > 45 || isNaN(n))) {
                return `Invalid numbers. Daily: 5 numbers (1-45). Example: DAILY 1,15,23,34,42`;
              }
              if (new Set(numbers).size !== numbers.length) {
                return `Numbers must be unique. Example: DAILY 1,15,23,34,42`;
              }
            } catch {
              return `Invalid format. Example: DAILY 1,15,23,34,42 or text DAILY for quick pick`;
            }
          } else {
            // Quick pick
            numbers = generateQuickPickNumbers(5, 45);
          }

          // Create session for payment confirmation
          this.createSession(phoneNumber, 'confirm_daily', { numbers, price: 0.50 });

          return `Daily Ticket: ${numbers.join(', ')}
Price: $0.50

Reply YES to confirm purchase or NO to cancel.`;

        } catch (error) {
          return `Unable to process ticket. Please try again.`;
        }
      }
    },

    WEEKLY: {
      code: 'WEEKLY',
      description: 'Buy weekly lottery ticket',
      handler: async (phoneNumber: string, params: string[]) => {
        try {
          const user = await storage.getUserByPhone(phoneNumber);
          if (!user) {
            return `No account found. Text REG to register.`;
          }

          if (user.kycStatus !== 'approved') {
            return `Identity verification required. Text KYC to complete verification.`;
          }

          if (parseFloat(user.balance) < 1.00) {
            return `Insufficient balance. Current: $${user.balance}. Need: $1.00. Add funds via EcoCash or agent.`;
          }

          // Check if numbers provided in SMS
          let numbers: number[] = [];
          if (params.length > 0) {
            try {
              numbers = params[0].split(',').map(n => parseInt(n.trim()));
              if (numbers.length !== 6 || numbers.some(n => n < 1 || n > 49 || isNaN(n))) {
                return `Invalid numbers. Weekly: 6 numbers (1-49). Example: WEEKLY 1,15,23,34,42,49`;
              }
              if (new Set(numbers).size !== numbers.length) {
                return `Numbers must be unique. Example: WEEKLY 1,15,23,34,42,49`;
              }
            } catch {
              return `Invalid format. Example: WEEKLY 1,15,23,34,42,49 or text WEEKLY for quick pick`;
            }
          } else {
            // Quick pick
            numbers = generateQuickPickNumbers(6, 49);
          }

          // Create session for payment confirmation
          this.createSession(phoneNumber, 'confirm_weekly', { numbers, price: 1.00 });

          return `Weekly Ticket: ${numbers.join(', ')}
Price: $1.00

Reply YES to confirm purchase or NO to cancel.`;

        } catch (error) {
          return `Unable to process ticket. Please try again.`;
        }
      }
    },

    RESULT: {
      code: 'RESULT',
      description: 'View latest draw results',
      handler: async (phoneNumber: string) => {
        try {
          const dailyDraw = await storage.getLatestDraw('daily');
          const weeklyDraw = await storage.getLatestDraw('weekly');

          let response = 'Latest Results:\n\n';

          if (dailyDraw && dailyDraw.winningNumbers && dailyDraw.winningNumbers.length > 0) {
            response += `Daily Draw: ${dailyDraw.winningNumbers.join(', ')}\n`;
            response += `Date: ${new Date(dailyDraw.drawDate).toLocaleDateString()}\n\n`;
          }

          if (weeklyDraw && weeklyDraw.winningNumbers && weeklyDraw.winningNumbers.length > 0) {
            response += `Weekly Draw: ${weeklyDraw.winningNumbers.join(', ')}\n`;
            response += `Date: ${new Date(weeklyDraw.drawDate).toLocaleDateString()}\n`;
            response += `Jackpot: $${weeklyDraw.jackpotAmount}\n\n`;
          }

          if (!dailyDraw?.winningNumbers && !weeklyDraw?.winningNumbers) {
            response += 'No recent results available.\n\n';
          }

          response += 'Text DAILY or WEEKLY to buy tickets.';
          return response;

        } catch (error) {
          return `Unable to fetch results. Please try again.`;
        }
      }
    },

    KYC: {
      code: 'KYC',
      description: 'Complete identity verification',
      handler: async (phoneNumber: string) => {
        try {
          const user = await storage.getUserByPhone(phoneNumber);
          if (!user) {
            return `No account found. Text REG to register.`;
          }

          if (user.kycStatus === 'approved') {
            return `Identity already verified ✓\n\nText DAILY or WEEKLY to buy tickets.`;
          }

          const kycLink = `https://mutapa-lottery.replit.app/verify-identity?phone=${encodeURIComponent(phoneNumber)}`;
          
          return `Identity Verification Required:

1. Visit: ${kycLink}
2. Upload valid ID document
3. Wait for approval (24-48 hours)

Or visit any Mutapa Lottery agent for assistance.

Text BAL to check verification status.`;

        } catch (error) {
          return `Unable to process KYC request. Please try again.`;
        }
      }
    },

    YES: {
      code: 'YES',
      description: 'Confirm pending action',
      handler: async (phoneNumber: string) => {
        const session = this.getSession(phoneNumber);
        if (!session || !session.pendingAction) {
          return `No pending action to confirm. Text HELP for commands.`;
        }

        try {
          if (session.pendingAction === 'confirm_daily' || session.pendingAction === 'confirm_weekly') {
            const { numbers, price } = session.pendingData;
            const drawType = session.pendingAction === 'confirm_daily' ? 'daily' : 'weekly';

            const user = await storage.getUserByPhone(phoneNumber);
            if (!user) {
              this.sessions.delete(phoneNumber);
              return `Account not found. Text REG to register.`;
            }

            if (parseFloat(user.balance) < price) {
              this.sessions.delete(phoneNumber);
              return `Insufficient balance. Current: $${user.balance}. Need: $${price}`;
            }

            // Get upcoming draw
            const upcomingDraw = await storage.getUpcomingDraw(drawType);
            if (!upcomingDraw) {
              this.sessions.delete(phoneNumber);
              return `No upcoming ${drawType} draw available.`;
            }

            // Create ticket
            const ticket = await storage.createTicket({
              userId: user.id,
              drawId: upcomingDraw.id,
              numbers,
              purchaseMethod: 'sms',
              agentId: null
            });

            // Deduct balance
            await storage.updateUserBalance(user.id, (parseFloat(user.balance) - price).toString());

            // Record transaction
            await storage.createTransaction({
              userId: user.id,
              type: 'ticket_purchase',
              amount: price.toString(),
              description: `${drawType.charAt(0).toUpperCase() + drawType.slice(1)} lottery ticket`,
              status: 'completed'
            });

            this.sessions.delete(phoneNumber);

            return `Ticket purchased successfully! ✓

Ticket #${ticket.ticketNumber}
Numbers: ${numbers.join(', ')}
Draw: ${new Date(upcomingDraw.drawDate).toLocaleDateString()}
Cost: $${price}

New balance: $${(parseFloat(user.balance) - price).toFixed(2)}

Good luck!`;
          }

          this.sessions.delete(phoneNumber);
          return `Action confirmed but no handler found.`;

        } catch (error) {
          this.sessions.delete(phoneNumber);
          return `Purchase failed. Please try again or contact support.`;
        }
      }
    },

    NO: {
      code: 'NO',
      description: 'Cancel pending action',
      handler: async (phoneNumber: string) => {
        const session = this.getSession(phoneNumber);
        if (session) {
          this.sessions.delete(phoneNumber);
          return `Action cancelled. Text HELP for commands.`;
        }
        return `No pending action to cancel. Text HELP for commands.`;
      }
    },

    STOP: {
      code: 'STOP',
      description: 'Stop SMS notifications',
      handler: async (phoneNumber: string) => {
        // In a real implementation, this would update user preferences
        return `SMS notifications stopped for ${phoneNumber}. Text START to resume or visit our website to manage preferences.`;
      }
    }
  };

  /**
   * Process incoming SMS message
   */
  public async processSMS(phoneNumber: string, message: string): Promise<string> {
    try {
      // Clean and parse message
      const cleanMessage = message.trim().toUpperCase();
      const parts = cleanMessage.split(' ');
      const command = parts[0];
      const params = parts.slice(1);

      // Check for registered commands
      if (this.commands[command]) {
        return await this.commands[command].handler(phoneNumber, params);
      }

      // Check for session-based responses (YES/NO)
      const session = this.getSession(phoneNumber);
      if (session && (command === 'YES' || command === 'NO')) {
        return await this.commands[command].handler(phoneNumber, params);
      }

      // Default help response for unrecognized commands
      return `Unknown command: ${command}

${await this.commands.HELP.handler(phoneNumber, [])}`;

    } catch (error) {
      console.error('SMS processing error:', error);
      return `SMS service temporarily unavailable. Please try again or contact support.`;
    }
  }

  /**
   * Get SMS shortcode (in real implementation, this would be configured)
   */
  private getShortcode(): string {
    return '345'; // Example shortcode
  }

  /**
   * Send SMS (placeholder for real SMS gateway integration)
   */
  public async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // In real implementation, integrate with SMS gateway (Twilio, etc.)
      console.log(`SMS to ${phoneNumber}: ${message}`);
      
      // For demo purposes, we'll simulate successful sending
      return true;
    } catch (error) {
      console.error('SMS sending error:', error);
      return false;
    }
  }

  /**
   * Send KYC verification SMS
   */
  public async sendKYCVerificationSMS(phoneNumber: string): Promise<boolean> {
    const kycLink = `https://mutapa-lottery.replit.app/verify-identity?phone=${encodeURIComponent(phoneNumber)}`;
    const message = `Mutapa Lottery: Complete your identity verification to start playing. Visit: ${kycLink}`;
    
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send draw result notification
   */
  public async sendDrawResultSMS(phoneNumber: string, drawType: 'daily' | 'weekly', winningNumbers: number[]): Promise<boolean> {
    const drawName = drawType === 'daily' ? 'Daily Draw' : 'Weekly Jackpot';
    const message = `Mutapa Lottery ${drawName} Results: ${winningNumbers.join(', ')}. Check your tickets at mutapa-lottery.replit.app or text RESULT.`;
    
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send winner notification SMS
   */
  public async sendWinnerSMS(phoneNumber: string, prizeAmount: string, matchedNumbers: number): Promise<boolean> {
    const message = `🎉 Congratulations! You won $${prizeAmount} with ${matchedNumbers} matching numbers! Visit our website or agent to claim your prize.`;
    
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Get available SMS commands for help
   */
  public getAvailableCommands(): SMSCommand[] {
    return Object.values(this.commands);
  }
}

export const smsService = SMSService.getInstance();