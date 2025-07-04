import { db } from './db';
import { systemSettings, type InsertSystemSettingsSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface SystemSetting {
  id: number;
  settingKey: string;
  settingValue: string;
  settingType: string;
  description: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export class SystemSettingsService {
  private static instance: SystemSettingsService;
  private cache: Map<string, any> = new Map();

  private constructor() {
    this.initializeDefaultSettings();
  }

  public static getInstance(): SystemSettingsService {
    if (!SystemSettingsService.instance) {
      SystemSettingsService.instance = new SystemSettingsService();
    }
    return SystemSettingsService.instance;
  }

  /**
   * Initialize default system settings if they don't exist
   */
  private async initializeDefaultSettings(): Promise<void> {
    try {
      const defaultSettings = [
        {
          settingKey: 'daily_draw_time',
          settingValue: '18:00',
          settingType: 'string',
          description: 'Default time for daily draws (24-hour format)',
          updatedBy: 'system'
        },
        {
          settingKey: 'weekly_draw_time', 
          settingValue: '20:00',
          settingType: 'string',
          description: 'Default time for weekly draws (24-hour format)',
          updatedBy: 'system'
        },
        {
          settingKey: 'daily_default_jackpot',
          settingValue: '1000',
          settingType: 'number',
          description: 'Default jackpot amount for daily draws (USD)',
          updatedBy: 'system'
        },
        {
          settingKey: 'weekly_default_jackpot',
          settingValue: '5000', 
          settingType: 'number',
          description: 'Default jackpot amount for weekly draws (USD)',
          updatedBy: 'system'
        },
        {
          settingKey: 'auto_draws_enabled',
          settingValue: 'true',
          settingType: 'boolean',
          description: 'Whether automatic draws are enabled',
          updatedBy: 'system'
        },
        {
          settingKey: 'draw_days',
          settingValue: JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
          settingType: 'json',
          description: 'Days when daily draws occur',
          updatedBy: 'system'
        },
        {
          settingKey: 'weekly_draw_day',
          settingValue: 'sunday',
          settingType: 'string', 
          description: 'Day when weekly draws occur',
          updatedBy: 'system'
        }
      ];

      for (const setting of defaultSettings) {
        const existing = await this.getSetting(setting.settingKey);
        if (existing === null) {
          await this.setSetting(
            setting.settingKey,
            setting.settingValue,
            setting.settingType,
            setting.description,
            setting.updatedBy
          );
        }
      }

      console.log('✅ System settings initialized with defaults');
    } catch (error) {
      console.error('Failed to initialize default settings:', error);
    }
  }

  /**
   * Get a setting value by key
   */
  public async getSetting(key: string): Promise<any> {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      // Query database
      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);

      if (!setting) {
        return null;
      }

      // Parse value based on type
      let value: any;
      switch (setting.settingType) {
        case 'number':
          value = parseFloat(setting.settingValue);
          break;
        case 'boolean':
          value = setting.settingValue === 'true';
          break;
        case 'json':
          value = JSON.parse(setting.settingValue);
          break;
        default:
          value = setting.settingValue;
      }

      // Cache the parsed value
      this.cache.set(key, value);
      return value;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a setting value
   */
  public async setSetting(
    key: string,
    value: any,
    type: string,
    description?: string,
    updatedBy?: string
  ): Promise<void> {
    try {
      // Convert value to string based on type
      let stringValue: string;
      switch (type) {
        case 'number':
          stringValue = value.toString();
          break;
        case 'boolean':
          stringValue = value ? 'true' : 'false';
          break;
        case 'json':
          stringValue = JSON.stringify(value);
          break;
        default:
          stringValue = value.toString();
      }

      // Update or insert setting
      const existing = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, key))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(systemSettings)
          .set({
            settingValue: stringValue,
            settingType: type,
            description: description || existing[0].description,
            updatedAt: new Date(),
            updatedBy: updatedBy || 'admin'
          })
          .where(eq(systemSettings.settingKey, key));
      } else {
        // Insert new
        await db
          .insert(systemSettings)
          .values({
            settingKey: key,
            settingValue: stringValue,
            settingType: type,
            description: description,
            updatedBy: updatedBy || 'admin'
          });
      }

      // Update cache
      this.cache.set(key, value);
      
      console.log(`✅ Setting updated: ${key} = ${value}`);
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all settings
   */
  public async getAllSettings(): Promise<Record<string, any>> {
    try {
      const settings = await db.select().from(systemSettings);
      const result: Record<string, any> = {};

      for (const setting of settings) {
        let value: any;
        switch (setting.settingType) {
          case 'number':
            value = parseFloat(setting.settingValue);
            break;
          case 'boolean':
            value = setting.settingValue === 'true';
            break;
          case 'json':
            value = JSON.parse(setting.settingValue);
            break;
          default:
            value = setting.settingValue;
        }
        result[setting.settingKey] = value;
      }

      return result;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }

  /**
   * Clear setting cache (call when settings are updated externally)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get draw settings for the scheduler
   */
  public async getDrawSettings(): Promise<{
    dailyDrawTime: string;
    weeklyDrawTime: string;
    dailyDefaultJackpot: number;
    weeklyDefaultJackpot: number;
    autoDrawsEnabled: boolean;
    drawDays: string[];
    weeklyDrawDay: string;
  }> {
    return {
      dailyDrawTime: await this.getSetting('daily_draw_time') || '18:00',
      weeklyDrawTime: await this.getSetting('weekly_draw_time') || '20:00',
      dailyDefaultJackpot: await this.getSetting('daily_default_jackpot') || 1000,
      weeklyDefaultJackpot: await this.getSetting('weekly_default_jackpot') || 5000,
      autoDrawsEnabled: await this.getSetting('auto_draws_enabled') || true,
      drawDays: await this.getSetting('draw_days') || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      weeklyDrawDay: await this.getSetting('weekly_draw_day') || 'sunday'
    };
  }

  /**
   * Update draw settings
   */
  public async updateDrawSettings(settings: {
    dailyDrawTime?: string;
    weeklyDrawTime?: string;
    dailyDefaultJackpot?: number;
    weeklyDefaultJackpot?: number;
    autoDrawsEnabled?: boolean;
    drawDays?: string[];
    weeklyDrawDay?: string;
  }, updatedBy: string = 'admin'): Promise<void> {
    const updates = [];

    if (settings.dailyDrawTime) {
      updates.push(this.setSetting('daily_draw_time', settings.dailyDrawTime, 'string', 'Default time for daily draws (24-hour format)', updatedBy));
    }
    if (settings.weeklyDrawTime) {
      updates.push(this.setSetting('weekly_draw_time', settings.weeklyDrawTime, 'string', 'Default time for weekly draws (24-hour format)', updatedBy));
    }
    if (settings.dailyDefaultJackpot !== undefined) {
      updates.push(this.setSetting('daily_default_jackpot', settings.dailyDefaultJackpot, 'number', 'Default jackpot amount for daily draws (USD)', updatedBy));
    }
    if (settings.weeklyDefaultJackpot !== undefined) {
      updates.push(this.setSetting('weekly_default_jackpot', settings.weeklyDefaultJackpot, 'number', 'Default jackpot amount for weekly draws (USD)', updatedBy));
    }
    if (settings.autoDrawsEnabled !== undefined) {
      updates.push(this.setSetting('auto_draws_enabled', settings.autoDrawsEnabled, 'boolean', 'Whether automatic draws are enabled', updatedBy));
    }
    if (settings.drawDays) {
      updates.push(this.setSetting('draw_days', settings.drawDays, 'json', 'Days when daily draws occur', updatedBy));
    }
    if (settings.weeklyDrawDay) {
      updates.push(this.setSetting('weekly_draw_day', settings.weeklyDrawDay, 'string', 'Day when weekly draws occur', updatedBy));
    }

    await Promise.all(updates);
    this.clearCache(); // Clear cache to force reload
  }
}

export const systemSettingsService = SystemSettingsService.getInstance();