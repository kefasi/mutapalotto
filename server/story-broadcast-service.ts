import { storage } from './database-storage';
import { notificationService } from './notification-service';
import { smsService } from './sms-service';

interface StoryBroadcastResult {
  success: boolean;
  storyId: number;
  recipientCount: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  details: {
    smsCount: number;
    notificationCount: number;
  };
}

interface BroadcastFilters {
  userRole?: 'user' | 'agent' | 'admin';
  kycStatus?: 'pending' | 'approved' | 'rejected';
  language?: 'en' | 'sn'; // English or Shona
  includeAgents?: boolean;
  includeUnverified?: boolean;
}

export class StoryBroadcastService {
  private static instance: StoryBroadcastService;

  private constructor() {}

  public static getInstance(): StoryBroadcastService {
    if (!StoryBroadcastService.instance) {
      StoryBroadcastService.instance = new StoryBroadcastService();
    }
    return StoryBroadcastService.instance;
  }

  /**
   * Broadcast a community story to users via SMS and push notifications
   */
  public async broadcastStory(
    storyId: number, 
    filters: BroadcastFilters = {}
  ): Promise<StoryBroadcastResult> {
    try {
      console.log(`📡 Starting story broadcast for story ID: ${storyId}`);

      // Get the story details
      const story = await storage.getCommunityStory(storyId);
      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`);
      }

      // Get eligible users based on filters
      const eligibleUsers = await this.getEligibleUsers(filters);
      console.log(`👥 Found ${eligibleUsers.length} eligible users for broadcast`);

      if (eligibleUsers.length === 0) {
        return {
          success: true,
          storyId,
          recipientCount: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          details: { smsCount: 0, notificationCount: 0 }
        };
      }

      let smsSuccessCount = 0;
      let notificationSuccessCount = 0;
      let totalFailures = 0;

      // Prepare broadcast content
      const title = story.title;
      const shortMessage = this.truncateForSMS(story.content);
      const storyUrl = `${process.env.BASE_URL || 'https://mutapa-lottery.replit.app'}/community/story/${storyId}`;

      // Broadcast to each eligible user
      for (const user of eligibleUsers) {
        try {
          // Send SMS notification
          const smsMessage = `${title}\n\n${shortMessage}\n\nRead full story: ${storyUrl}\n\n- Mutapa Lottery`;
          
          const smsResult = await smsService.sendSMS(user.phone, smsMessage);
          if (smsResult.success) {
            smsSuccessCount++;
          } else {
            totalFailures++;
          }

          // Send push notification (if supported)
          try {
            await notificationService.sendStoryNotification(user.id, {
              title: `New Story: ${title}`,
              message: shortMessage,
              storyId,
              storyUrl,
              type: 'community_story'
            });
            notificationSuccessCount++;
          } catch (notifError) {
            console.warn(`Push notification failed for user ${user.id}:`, notifError);
            // Don't count as total failure since SMS might have succeeded
          }

          // Small delay to prevent overwhelming services
          await this.delay(100);

        } catch (userError) {
          console.error(`Failed to notify user ${user.id}:`, userError);
          totalFailures++;
        }
      }

      // Mark story as featured after successful broadcast
      if (smsSuccessCount > 0 || notificationSuccessCount > 0) {
        await storage.updateCommunityStory(storyId, { featured: true });
      }

      const result: StoryBroadcastResult = {
        success: true,
        storyId,
        recipientCount: eligibleUsers.length,
        successfulDeliveries: smsSuccessCount + notificationSuccessCount,
        failedDeliveries: totalFailures,
        details: {
          smsCount: smsSuccessCount,
          notificationCount: notificationSuccessCount
        }
      };

      console.log(`✅ Story broadcast completed:`, result);
      return result;

    } catch (error) {
      console.error(`❌ Story broadcast failed:`, error);
      return {
        success: false,
        storyId,
        recipientCount: 0,
        successfulDeliveries: 0,
        failedDeliveries: 1,
        details: { smsCount: 0, notificationCount: 0 }
      };
    }
  }

  /**
   * Get users eligible for story broadcast based on filters
   */
  private async getEligibleUsers(filters: BroadcastFilters): Promise<any[]> {
    try {
      let users = await storage.getAllUsers();

      // Filter by role
      if (filters.userRole) {
        users = users.filter(user => user.role === filters.userRole);
      }

      // Filter by KYC status
      if (filters.kycStatus) {
        users = users.filter(user => user.kycStatus === filters.kycStatus);
      }

      // Include/exclude agents
      if (filters.includeAgents === false) {
        users = users.filter(user => user.role !== 'agent');
      }

      // Include/exclude unverified users
      if (filters.includeUnverified === false) {
        users = users.filter(user => user.kycStatus !== 'pending');
      }

      // Filter out banned/frozen users
      users = users.filter(user => 
        user.accountStatus !== 'banned' && 
        user.accountStatus !== 'frozen'
      );

      // Filter by language preference (if available in user profile)
      // For now, we'll include all users as language preference is not in user schema
      
      return users;

    } catch (error) {
      console.error('Error getting eligible users:', error);
      return [];
    }
  }

  /**
   * Truncate story content for SMS (keep under 160 characters for single SMS)
   */
  private truncateForSMS(content: string, maxLength: number = 120): string {
    if (content.length <= maxLength) {
      return content;
    }
    
    // Find the last complete sentence within the limit
    const truncated = content.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    // If no sentence break found, truncate at word boundary
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated.substring(0, maxLength - 3) + '...';
  }

  /**
   * Delay helper function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Preview broadcast recipients without sending
   */
  public async previewBroadcast(filters: BroadcastFilters = {}): Promise<{
    eligibleUsers: number;
    userBreakdown: {
      regular: number;
      agents: number;
      verified: number;
      unverified: number;
    };
  }> {
    const users = await this.getEligibleUsers(filters);
    
    const breakdown = {
      regular: users.filter(u => u.role === 'user').length,
      agents: users.filter(u => u.role === 'agent').length,
      verified: users.filter(u => u.kycStatus === 'approved').length,
      unverified: users.filter(u => u.kycStatus === 'pending').length
    };

    return {
      eligibleUsers: users.length,
      userBreakdown: breakdown
    };
  }

  /**
   * Send urgent announcement to all users
   */
  public async sendUrgentAnnouncement(
    title: string, 
    message: string, 
    includeAgents: boolean = true
  ): Promise<StoryBroadcastResult> {
    try {
      const filters: BroadcastFilters = {
        includeAgents,
        includeUnverified: true
      };

      const users = await this.getEligibleUsers(filters);
      let smsSuccessCount = 0;
      let totalFailures = 0;

      const urgentMessage = `🚨 URGENT: ${title}\n\n${message}\n\n- Mutapa Lottery Management`;

      for (const user of users) {
        try {
          const smsResult = await smsService.sendSMS(user.phone, urgentMessage);
          if (smsResult.success) {
            smsSuccessCount++;
          } else {
            totalFailures++;
          }
          await this.delay(100);
        } catch (error) {
          totalFailures++;
        }
      }

      return {
        success: true,
        storyId: 0, // Not a story broadcast
        recipientCount: users.length,
        successfulDeliveries: smsSuccessCount,
        failedDeliveries: totalFailures,
        details: { smsCount: smsSuccessCount, notificationCount: 0 }
      };

    } catch (error) {
      console.error('Urgent announcement failed:', error);
      return {
        success: false,
        storyId: 0,
        recipientCount: 0,
        successfulDeliveries: 0,
        failedDeliveries: 1,
        details: { smsCount: 0, notificationCount: 0 }
      };
    }
  }
}

export const storyBroadcastService = StoryBroadcastService.getInstance();