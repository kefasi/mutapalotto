import crypto from 'crypto';

interface AdminCredentials {
  adminId: string;
  password: string;
  expiresAt: Date;
  generatedAt: Date;
}

export class AdminAuthService {
  private static instance: AdminAuthService;
  private currentCredentials: AdminCredentials | null = null;
  
  // Permanent admin credentials for consistent access
  private readonly permanentAdmin = {
    adminId: 'MUTAPA_ADMIN',
    password: 'ZimbabweLottery2025!'
  };

  private constructor() {
    this.generateDailyCredentials();
  }

  public static getInstance(): AdminAuthService {
    if (!AdminAuthService.instance) {
      AdminAuthService.instance = new AdminAuthService();
    }
    return AdminAuthService.instance;
  }

  /**
   * Generate new admin credentials for the day
   */
  public generateDailyCredentials(): AdminCredentials {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Generate unique admin ID (8 characters alphanumeric)
    const adminId = this.generateSecureId(8);
    
    // Generate secure password (12 characters with mixed case, numbers, symbols)
    const password = this.generateSecurePassword(12);

    this.currentCredentials = {
      adminId,
      password,
      expiresAt: tomorrow,
      generatedAt: today
    };

    console.log('🔐 New Daily Admin Credentials Generated:');
    console.log(`Admin ID: ${adminId}`);
    console.log(`Password: ${password}`);
    console.log(`Valid until: ${tomorrow.toLocaleString()}`);

    return this.currentCredentials;
  }

  /**
   * Validate admin credentials
   */
  public validateCredentials(adminId: string, password: string): boolean {
    console.log('🔍 Admin validation attempt:');
    console.log('  Provided ID:', adminId);
    console.log('  Password length:', password?.length);
    console.log('  Permanent ID:', this.permanentAdmin.adminId);
    console.log('  Permanent password:', this.permanentAdmin.password);
    
    // Check permanent admin credentials first
    if (adminId === this.permanentAdmin.adminId && password === this.permanentAdmin.password) {
      console.log('✅ Permanent admin credentials matched');
      return true;
    }

    // Check daily rotating credentials
    if (!this.currentCredentials) {
      console.log('❌ No current credentials available');
      return false;
    }

    // Check if credentials have expired
    if (new Date() > this.currentCredentials.expiresAt) {
      console.log('🔄 Credentials expired, regenerating...');
      this.generateDailyCredentials();
    }

    const result = this.currentCredentials.adminId === adminId && 
                   this.currentCredentials.password === password;
    
    console.log('💡 Daily credentials check result:', result);
    console.log('  Daily ID:', this.currentCredentials.adminId);
    
    return result;
  }

  /**
   * Get current valid credentials
   */
  public getCurrentCredentials(): AdminCredentials | null {
    if (!this.currentCredentials) {
      return null;
    }

    // Check if credentials have expired
    if (new Date() > this.currentCredentials.expiresAt) {
      this.generateDailyCredentials();
    }

    return this.currentCredentials;
  }

  /**
   * Force regenerate credentials (for manual rotation)
   */
  public rotateCredentials(): AdminCredentials {
    return this.generateDailyCredentials();
  }

  /**
   * Check if credentials need rotation
   */
  public needsRotation(): boolean {
    if (!this.currentCredentials) {
      return true;
    }
    return new Date() > this.currentCredentials.expiresAt;
  }

  /**
   * Generate secure alphanumeric ID
   */
  private generateSecureId(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomBytes = crypto.randomBytes(1);
      const randomIndex = randomBytes[0] % chars.length;
      result += chars[randomIndex];
    }
    
    return result;
  }

  /**
   * Generate secure password with mixed characters
   */
  private generateSecurePassword(length: number): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each category
    const randomBytes = crypto.randomBytes(length);
    password += uppercase[randomBytes[0] % uppercase.length];
    password += lowercase[randomBytes[1] % lowercase.length];
    password += numbers[randomBytes[2] % numbers.length];
    password += symbols[randomBytes[3] % symbols.length];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[randomBytes[i] % allChars.length];
    }
    
    // Shuffle the password
    return password.split('').sort(() => randomBytes[0] - 128).join('');
  }

  /**
   * Get permanent admin credentials
   */
  public getPermanentCredentials(): { adminId: string; password: string } {
    return {
      adminId: this.permanentAdmin.adminId,
      password: this.permanentAdmin.password
    };
  }

  /**
   * Get time until next rotation
   */
  public getTimeUntilRotation(): string {
    if (!this.currentCredentials) {
      return 'Unknown';
    }

    const now = new Date();
    const expiry = this.currentCredentials.expiresAt;
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Expired - rotating now';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }
}

export const adminAuthService = AdminAuthService.getInstance();