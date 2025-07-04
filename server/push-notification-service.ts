import { storage } from './storage';

/**
 * Push Notification Service using Firebase Cloud Messaging
 * Handles lottery results, winner notifications, and system alerts
 */
export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmServerKey: string | null = null;
  private fcmApiUrl = 'https://fcm.googleapis.com/fcm/send';

  private constructor() {
    this.fcmServerKey = process.env.FCM_SERVER_KEY || null;
    if (!this.fcmServerKey) {
      console.warn('FCM_SERVER_KEY not found. Push notifications will be logged only.');
    }
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Send draw results notification to all subscribed users
   */
  public async notifyDrawResults(drawId: number): Promise<void> {
    try {
      const draw = await storage.getDrawById(drawId);
      if (!draw) return;

      const subscribedUsers = await storage.getUsersWithPushTokens();
      
      const notification = {
        title: `🎉 ${draw.type.toUpperCase()} DRAW RESULTS`,
        body: `Winning Numbers: ${draw.winningNumbers.join(' • ')} | Jackpot: $${draw.jackpotAmount}`,
        data: {
          type: 'draw_results',
          drawId: drawId.toString(),
          drawType: draw.type,
          winningNumbers: JSON.stringify(draw.winningNumbers),
          jackpot: draw.jackpotAmount,
        },
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        click_action: '/',
      };

      await this.sendToMultipleDevices(
        subscribedUsers.map(user => user.fcmToken!),
        notification
      );

      console.log(`Draw results notification sent to ${subscribedUsers.length} users`);

    } catch (error) {
      console.error('Error sending draw results notification:', error);
    }
  }

  /**
   * Send winner notification to specific user
   */
  public async notifyWinner(ticketId: number): Promise<void> {
    try {
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket || !ticket.isWinner) return;

      const user = await storage.getUserById(ticket.userId);
      if (!user?.fcmToken) return;

      const notification = {
        title: '🏆 CONGRATULATIONS! YOU WON!',
        body: `Ticket ${ticket.id} won $${ticket.prizeAmount}! Numbers: ${ticket.numbers.join(' • ')}`,
        data: {
          type: 'winner_notification',
          ticketId: ticketId.toString(),
          prizeAmount: ticket.prizeAmount || '0',
          numbers: JSON.stringify(ticket.numbers),
        },
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        click_action: '/tickets',
        sound: 'winner_sound.mp3',
      };

      await this.sendToDevice(user.fcmToken, notification);

      // Log winner notification for audit
      await storage.createNotificationLog({
        userId: user.id,
        type: 'winner',
        title: notification.title,
        body: notification.body,
        data: JSON.stringify(notification.data),
        sentAt: new Date(),
        status: 'sent',
      });

      console.log(`Winner notification sent to user ${user.id} for ticket ${ticketId}`);

    } catch (error) {
      console.error('Error sending winner notification:', error);
    }
  }

  /**
   * Send draw countdown notification
   */
  public async notifyDrawCountdown(drawType: 'daily' | 'weekly', hoursUntilDraw: number): Promise<void> {
    try {
      const subscribedUsers = await storage.getUsersWithPushTokens();
      
      let message = '';
      if (hoursUntilDraw <= 1) {
        message = `${drawType.toUpperCase()} draw starting in ${hoursUntilDraw * 60} minutes!`;
      } else {
        message = `${drawType.toUpperCase()} draw in ${hoursUntilDraw} hours!`;
      }

      const notification = {
        title: '⏰ DRAW REMINDER',
        body: `${message} Get your tickets now!`,
        data: {
          type: 'draw_countdown',
          drawType,
          hoursUntilDraw: hoursUntilDraw.toString(),
        },
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        click_action: '/',
      };

      await this.sendToMultipleDevices(
        subscribedUsers.map(user => user.fcmToken!),
        notification
      );

      console.log(`Draw countdown notification sent to ${subscribedUsers.length} users`);

    } catch (error) {
      console.error('Error sending countdown notification:', error);
    }
  }

  /**
   * Send system alert notification
   */
  public async notifySystemAlert(alert: {
    type: 'maintenance' | 'draw_halt' | 'security' | 'update';
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    try {
      const subscribedUsers = await storage.getUsersWithPushTokens();
      
      const notification = {
        title: `🚨 ${alert.title}`,
        body: alert.message,
        data: {
          type: 'system_alert',
          alertType: alert.type,
          severity: alert.severity,
        },
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        click_action: '/',
        priority: alert.severity === 'critical' ? 'high' : 'normal',
      };

      await this.sendToMultipleDevices(
        subscribedUsers.map(user => user.fcmToken!),
        notification
      );

      console.log(`System alert sent to ${subscribedUsers.length} users: ${alert.title}`);

    } catch (error) {
      console.error('Error sending system alert:', error);
    }
  }

  /**
   * Send agent commission notification
   */
  public async notifyAgentCommission(agentId: number, amount: string, period: string): Promise<void> {
    try {
      const agent = await storage.getUserById(agentId);
      if (!agent?.fcmToken) return;

      const notification = {
        title: '💰 COMMISSION PAYMENT',
        body: `Your commission of $${amount} for ${period} has been processed!`,
        data: {
          type: 'commission_payment',
          amount,
          period,
        },
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        click_action: '/agentportal',
      };

      await this.sendToDevice(agent.fcmToken, notification);

      console.log(`Commission notification sent to agent ${agentId}`);

    } catch (error) {
      console.error('Error sending commission notification:', error);
    }
  }

  /**
   * Send notification to single device
   */
  private async sendToDevice(fcmToken: string, notification: any): Promise<void> {
    if (!this.fcmServerKey) {
      console.log('FCM notification (logged only):', { fcmToken, notification });
      return;
    }

    try {
      const payload = {
        to: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          click_action: notification.click_action,
          sound: notification.sound || 'default',
        },
        data: notification.data,
        priority: notification.priority || 'normal',
      };

      const response = await fetch(this.fcmApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.fcmServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('FCM send error:', error);
        
        // Remove invalid tokens
        if (response.status === 400 || response.status === 404) {
          await this.removeInvalidToken(fcmToken);
        }
      }

    } catch (error) {
      console.error('Error sending FCM notification:', error);
    }
  }

  /**
   * Send notification to multiple devices
   */
  private async sendToMultipleDevices(fcmTokens: string[], notification: any): Promise<void> {
    if (!this.fcmServerKey) {
      console.log('FCM batch notification (logged only):', { tokenCount: fcmTokens.length, notification });
      return;
    }

    // Split into batches of 1000 (FCM limit)
    const batchSize = 1000;
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);
      
      try {
        const payload = {
          registration_ids: batch,
          notification: {
            title: notification.title,
            body: notification.body,
            icon: notification.icon,
            badge: notification.badge,
            click_action: notification.click_action,
            sound: notification.sound || 'default',
          },
          data: notification.data,
          priority: notification.priority || 'normal',
        };

        const response = await fetch(this.fcmApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `key=${this.fcmServerKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('FCM batch send error:', error);
        } else {
          const result = await response.json();
          
          // Clean up invalid tokens
          if (result.results) {
            for (let j = 0; j < result.results.length; j++) {
              const tokenResult = result.results[j];
              if (tokenResult.error === 'NotRegistered' || tokenResult.error === 'InvalidRegistration') {
                await this.removeInvalidToken(batch[j]);
              }
            }
          }
        }

      } catch (error) {
        console.error('Error sending FCM batch notification:', error);
      }
    }
  }

  /**
   * Register user's FCM token
   */
  public async registerToken(userId: number, fcmToken: string): Promise<void> {
    try {
      await storage.updateUserFCMToken(userId, fcmToken);
      console.log(`FCM token registered for user ${userId}`);
    } catch (error) {
      console.error('Error registering FCM token:', error);
    }
  }

  /**
   * Remove invalid FCM token
   */
  private async removeInvalidToken(fcmToken: string): Promise<void> {
    try {
      await storage.removeInvalidFCMToken(fcmToken);
      console.log('Removed invalid FCM token');
    } catch (error) {
      console.error('Error removing invalid FCM token:', error);
    }
  }

  /**
   * Send test notification
   */
  public async sendTestNotification(userId: number): Promise<boolean> {
    try {
      const user = await storage.getUserById(userId);
      if (!user?.fcmToken) {
        console.log('No FCM token found for user');
        return false;
      }

      const notification = {
        title: '🏛️ Test Notification',
        body: 'Mutapa Lottery notifications are working!',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        click_action: '/',
      };

      await this.sendToDevice(user.fcmToken, notification);
      return true;

    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Get notification statistics
   */
  public async getNotificationStats(): Promise<{
    totalUsers: number;
    usersWithTokens: number;
    notificationsSentToday: number;
    notificationsSentThisWeek: number;
  }> {
    try {
      const totalUsers = await storage.getTotalUsersCount();
      const usersWithTokens = await storage.getUsersWithPushTokensCount();
      const notificationsSentToday = await storage.getNotificationsSentCount('today');
      const notificationsSentThisWeek = await storage.getNotificationsSentCount('week');

      return {
        totalUsers,
        usersWithTokens,
        notificationsSentToday,
        notificationsSentThisWeek,
      };

    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        totalUsers: 0,
        usersWithTokens: 0,
        notificationsSentToday: 0,
        notificationsSentThisWeek: 0,
      };
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();