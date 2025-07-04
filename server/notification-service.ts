import { storage } from "./storage";
import { smsService } from "./sms-service";
import { InsertUserNotification } from "@shared/schema";

/**
 * Comprehensive Notification Service for ID Verification Reminders and User Alerts
 * Handles SMS notifications for unverified users and general system notifications
 */
export class NotificationService {
  private static instance: NotificationService;
  
  private constructor() {}
  
  public static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }

  /**
   * Schedule ID verification reminder for a user
   */
  public async scheduleIdVerificationReminder(userId: number): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || user.kycVerified) {
        return; // User doesn't exist or is already verified
      }

      // Don't send more than 3 reminders total
      if (user.verificationReminderCount >= 3) {
        return;
      }

      // Don't send reminder if sent within last 24 hours
      const lastReminder = user.lastVerificationReminder;
      if (lastReminder) {
        const hoursSinceLastReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastReminder < 24) {
          return;
        }
      }

      // Create notification record
      const notification: InsertUserNotification = {
        userId,
        type: 'id_verification_reminder',
        title: 'ID Verification Required',
        message: `Hello ${user.name}! Please verify your identity to access full lottery services. Visit our office or upload your national ID. Reply VERIFY for instructions.`,
        method: 'sms',
        status: 'pending',
        metadata: {
          phone: user.phone,
          reminderCount: user.verificationReminderCount + 1
        },
        scheduledAt: new Date()
      };

      // Save notification
      await storage.createUserNotification(notification);

      // Send SMS
      const sent = await this.sendSmsNotification(user.phone, notification.message);
      
      if (sent) {
        // Update notification status and user reminder tracking
        await storage.updateUserNotification(userId, {
          status: 'sent',
          sentAt: new Date()
        });

        await storage.updateUserVerificationReminder(userId, {
          lastVerificationReminder: new Date(),
          verificationReminderCount: user.verificationReminderCount + 1
        });

        console.log(`[NOTIFICATION] ID verification reminder sent to ${user.phone}`);
      } else {
        await storage.updateUserNotification(userId, {
          status: 'failed'
        });
        console.error(`[NOTIFICATION] Failed to send ID verification reminder to ${user.phone}`);
      }

    } catch (error) {
      console.error(`[NOTIFICATION] Error scheduling ID verification reminder:`, error);
    }
  }

  /**
   * Send daily reminders to all unverified users
   */
  public async sendDailyVerificationReminders(): Promise<void> {
    try {
      console.log('[NOTIFICATION] Starting daily ID verification reminder job...');
      
      const unverifiedUsers = await storage.getUnverifiedUsers();
      console.log(`[NOTIFICATION] Found ${unverifiedUsers.length} unverified users`);

      for (const user of unverifiedUsers) {
        // Only send to users registered for more than 1 day
        const daysSinceRegistration = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRegistration >= 1) {
          await this.scheduleIdVerificationReminder(user.id);
          // Add small delay to avoid overwhelming SMS service
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('[NOTIFICATION] Daily ID verification reminder job completed');
    } catch (error) {
      console.error('[NOTIFICATION] Error in daily verification reminders:', error);
    }
  }

  /**
   * Send draw result notification
   */
  public async sendDrawResultNotification(userId: number, drawType: string, winningNumbers: number[], isWinner: boolean, prizeAmount?: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return;

      let message = `MUTAPA LOTTERY: ${drawType.toUpperCase()} DRAW RESULTS\n`;
      message += `Winning Numbers: ${winningNumbers.join(', ')}\n`;
      
      if (isWinner && prizeAmount) {
        message += `🎉 CONGRATULATIONS! You won $${prizeAmount}! Prize will be credited to your account.`;
      } else {
        message += `Better luck next time! Keep playing for your chance to win big.`;
      }

      const notification: InsertUserNotification = {
        userId,
        type: 'draw_result',
        title: `${drawType} Draw Results`,
        message,
        method: 'sms',
        status: 'pending',
        metadata: {
          phone: user.phone,
          drawType,
          winningNumbers,
          isWinner,
          prizeAmount
        },
        scheduledAt: new Date()
      };

      await storage.createUserNotification(notification);
      const sent = await this.sendSmsNotification(user.phone, message);
      
      await storage.updateUserNotification(userId, {
        status: sent ? 'sent' : 'failed',
        sentAt: sent ? new Date() : undefined
      });

    } catch (error) {
      console.error('[NOTIFICATION] Error sending draw result notification:', error);
    }
  }

  /**
   * Send low balance notification
   */
  public async sendLowBalanceNotification(userId: number): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return;

      const message = `MUTAPA LOTTERY: Your account balance is low ($${user.balance}). Add funds via EcoCash to continue playing. Text TOPUP for instructions.`;

      const notification: InsertUserNotification = {
        userId,
        type: 'low_balance',
        title: 'Low Balance Alert',
        message,
        method: 'sms',
        status: 'pending',
        metadata: {
          phone: user.phone,
          currentBalance: user.balance
        },
        scheduledAt: new Date()
      };

      await storage.createUserNotification(notification);
      const sent = await this.sendSmsNotification(user.phone, message);
      
      await storage.updateUserNotification(userId, {
        status: sent ? 'sent' : 'failed',
        sentAt: sent ? new Date() : undefined
      });

    } catch (error) {
      console.error('[NOTIFICATION] Error sending low balance notification:', error);
    }
  }

  /**
   * Send system update notification
   */
  public async sendSystemNotification(userId: number, title: string, message: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return;

      const notification: InsertUserNotification = {
        userId,
        type: 'system_update',
        title,
        message,
        method: 'sms',
        status: 'pending',
        metadata: {
          phone: user.phone
        },
        scheduledAt: new Date()
      };

      await storage.createUserNotification(notification);
      const sent = await this.sendSmsNotification(user.phone, message);
      
      await storage.updateUserNotification(userId, {
        status: sent ? 'sent' : 'failed',
        sentAt: sent ? new Date() : undefined
      });

    } catch (error) {
      console.error('[NOTIFICATION] Error sending system notification:', error);
    }
  }

  /**
   * Send SMS notification using SMS service
   */
  private async sendSmsNotification(phone: string, message: string): Promise<boolean> {
    try {
      return await smsService.sendSMS(phone, message);
    } catch (error) {
      console.error('[NOTIFICATION] SMS sending failed:', error);
      return false;
    }
  }

  /**
   * Start daily notification scheduler
   */
  public startDailyScheduler(): void {
    // Run daily at 9 AM
    const runDaily = () => {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(9, 0, 0, 0); // 9:00 AM

      if (now >= targetTime) {
        targetTime.setDate(targetTime.getDate() + 1); // Next day
      }

      const timeUntilTarget = targetTime.getTime() - now.getTime();
      
      setTimeout(() => {
        this.sendDailyVerificationReminders();
        setInterval(() => {
          this.sendDailyVerificationReminders();
        }, 24 * 60 * 60 * 1000); // Repeat every 24 hours
      }, timeUntilTarget);
    };

    runDaily();
    console.log('[NOTIFICATION] Daily scheduler initialized - will run at 9:00 AM daily');
  }

  /**
   * Get notification statistics
   */
  public async getNotificationStats(): Promise<{
    totalSent: number;
    todaySent: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    try {
      return await storage.getNotificationStats();
    } catch (error) {
      console.error('[NOTIFICATION] Error getting notification stats:', error);
      return {
        totalSent: 0,
        todaySent: 0,
        failed: 0,
        byType: {}
      };
    }
  }
}

export const notificationService = NotificationService.getInstance();