/**
 * EcoCash Payment Integration Service
 * Based on the official EcoCash Ruby API - converted to Node.js/TypeScript
 * Handles real EcoCash Instant Payments (EIP) API integration
 */

interface EcoCashConfig {
  // Authentication
  username: string;
  password: string;
  
  // Merchant Details
  merchantNumber: string;
  merchantCode: string;
  merchantPin: string;
  merchantName: string;
  superMerchantName: string;
  
  // API Configuration
  apiBaseUrl: string;
  notifyUrl: string;
  
  // Transaction Details
  description: string;
  onBehalfOf: string;
  paymentRemarks: string;
  referenceCode: string;
  purchaseCategoryCode: string;
  refundRemarks: string;
  
  // Location and Terminal
  terminalId: string;
  location: string;
  
  // Currency and Country
  currencyCode: string;
  countryCode: string;
  
  // Client Correlator
  clientCorrelatorPrefix: string;
}

interface PaymentRequest {
  phoneNumber: string;
  amount: number;
  reference?: string;
  description?: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  ecocashReference?: string;
  clientCorrelator?: string;
  message: string;
  errorCode?: string;
  rawResponse?: any;
}

interface TransactionStatus {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  phoneNumber: string;
  timestamp: Date;
  ecocashReference?: string;
}

export class RealEcoCashService {
  private static instance: RealEcoCashService;
  private config: EcoCashConfig;
  private pendingTransactions = new Map<string, any>();

  private constructor() {
    this.config = {
      // Authentication (required from EcoCash)
      username: process.env.ECOCASH_USERNAME || '',
      password: process.env.ECOCASH_PASSWORD || '',
      
      // Merchant Details (required from EcoCash)
      merchantNumber: process.env.ECOCASH_MERCHANT_NUMBER || '',
      merchantCode: process.env.ECOCASH_MERCHANT_CODE || '',
      merchantPin: process.env.ECOCASH_MERCHANT_PIN || '',
      merchantName: process.env.ECOCASH_MERCHANT_NAME || 'Mutapa Lottery',
      superMerchantName: process.env.ECOCASH_SUPER_MERCHANT_NAME || 'Mutapa Lottery',
      
      // API Configuration
      apiBaseUrl: process.env.ECOCASH_API_BASE_URL || 'https://api.ecocash.co.zw/v1',
      notifyUrl: process.env.ECOCASH_NOTIFY_URL || 'https://your-domain.com/api/ecocash/callback',
      
      // Transaction Configuration
      description: 'Lottery Ticket Purchase',
      onBehalfOf: 'Mutapa Lottery Platform',
      paymentRemarks: 'Lottery ticket payment',
      referenceCode: 'LOTTERY_PAYMENT',
      purchaseCategoryCode: 'Online Payment',
      refundRemarks: 'Lottery ticket refund',
      
      // Terminal and Location
      terminalId: 'MUTAPA_WEB_01',
      location: 'Harare, Zimbabwe',
      
      // Currency and Country
      currencyCode: 'USD',
      countryCode: 'ZW',
      
      // Client Correlator
      clientCorrelatorPrefix: 'MUTAPA'
    };

    console.log('🏦 Real EcoCash Service initialized:', {
      apiBaseUrl: this.config.apiBaseUrl,
      merchantName: this.config.merchantName,
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'PRODUCTION' : 'SIMULATION'
    });
  }

  public static getInstance(): RealEcoCashService {
    if (!RealEcoCashService.instance) {
      RealEcoCashService.instance = new RealEcoCashService();
    }
    return RealEcoCashService.instance;
  }

  /**
   * Check if EcoCash is properly configured with real credentials
   */
  public isConfigured(): boolean {
    return !!(
      this.config.username &&
      this.config.password &&
      this.config.merchantCode &&
      this.config.merchantNumber &&
      this.config.merchantPin
    );
  }

  /**
   * Charge subscriber using EcoCash API (equivalent to Ruby charge_subscriber)
   */
  public async requestPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log(`💳 Processing EcoCash payment: ${request.phoneNumber} - $${request.amount}`);
      
      if (!this.isConfigured()) {
        console.warn('⚠️ EcoCash not configured - running in simulation mode');
        return this.simulatePayment(request);
      }

      const clientCorrelator = this.generateClientCorrelator();
      const url = `${this.config.apiBaseUrl}/transactions/amount`;
      
      const paymentData = {
        clientCorrelator,
        notifyUrl: this.config.notifyUrl,
        referenceCode: this.config.referenceCode,
        tranType: 'MER',
        endUserId: request.phoneNumber,
        remarks: request.description || this.config.paymentRemarks,
        transactionOperationStatus: 'CHARGED',
        paymentAmount: {
          charginginformation: {
            amount: request.amount,
            currency: this.config.currencyCode,
            description: request.description || this.config.description
          },
          chargeMetaData: {
            channel: 'WEB',
            purchaseCategoryCode: this.config.purchaseCategoryCode,
            onBeHalfOf: this.config.onBehalfOf
          }
        },
        merchantCode: this.config.merchantCode,
        merchantPin: this.config.merchantPin,
        merchantNumber: this.config.merchantNumber,
        currencyCode: this.config.currencyCode,
        countryCode: this.config.countryCode,
        terminalID: this.config.terminalId,
        location: this.config.location,
        superMerchantName: this.config.superMerchantName,
        merchantName: this.config.merchantName
      };

      const response = await this.makeApiCall('POST', url, paymentData);
      
      // Store transaction for tracking
      this.pendingTransactions.set(clientCorrelator, {
        ...request,
        clientCorrelator,
        status: 'pending',
        timestamp: new Date(),
        rawResponse: response
      });

      return {
        success: true,
        transactionId: clientCorrelator,
        clientCorrelator,
        message: `Payment request sent to ${request.phoneNumber}. Customer will receive USSD prompt.`,
        rawResponse: response
      };

    } catch (error) {
      console.error('EcoCash payment request failed:', error);
      return {
        success: false,
        message: 'Payment request failed. Please check your EcoCash configuration.',
        errorCode: 'PAYMENT_REQUEST_FAILED'
      };
    }
  }

  /**
   * Check transaction status (equivalent to Ruby transaction_status)
   */
  public async getTransactionStatus(phoneNumber: string, clientCorrelator: string): Promise<any> {
    try {
      if (!this.isConfigured()) {
        return this.getSimulatedStatus(clientCorrelator);
      }

      const url = `${this.config.apiBaseUrl}/${phoneNumber}/transactions/amount/${clientCorrelator}`;
      const response = await this.makeApiCall('GET', url);
      
      return response;

    } catch (error) {
      console.error('EcoCash status check failed:', error);
      return null;
    }
  }

  /**
   * List subscriber transactions (equivalent to Ruby list_transactions)
   */
  public async listTransactions(phoneNumber: string): Promise<any> {
    try {
      if (!this.isConfigured()) {
        return [];
      }

      const url = `${this.config.apiBaseUrl}/${phoneNumber}/transactions`;
      const response = await this.makeApiCall('GET', url);
      
      return response;

    } catch (error) {
      console.error('EcoCash transaction list failed:', error);
      return [];
    }
  }

  /**
   * Process refund (equivalent to Ruby transaction_reversal)
   */
  public async processRefund(phoneNumber: string, originalTransactionId: string, amount: number): Promise<PaymentResponse> {
    try {
      console.log(`💰 Processing EcoCash refund: ${originalTransactionId} - $${amount}`);
      
      if (!this.isConfigured()) {
        return this.simulateRefund(amount);
      }

      const clientCorrelator = this.generateClientCorrelator();
      const url = `${this.config.apiBaseUrl}/transactions/refund`;
      
      const refundData = {
        clientCorrelator,
        referenceCode: this.config.referenceCode,
        tranType: 'REF',
        endUserId: phoneNumber,
        originalEcocashReference: originalTransactionId,
        remark: this.config.refundRemarks,
        paymentAmount: {
          charginginformation: {
            amount: amount,
            currency: this.config.currencyCode,
            description: this.config.description
          },
          chargeMetaData: {
            channel: 'SMS',
            purchaseCategoryCode: this.config.purchaseCategoryCode,
            onBeHalfOf: this.config.onBehalfOf
          }
        },
        merchantCode: this.config.merchantCode,
        merchantPin: this.config.merchantPin,
        merchantNumber: this.config.merchantNumber,
        currencyCode: this.config.currencyCode,
        countryCode: this.config.countryCode,
        terminalID: this.config.terminalId,
        location: this.config.location,
        superMerchantName: this.config.superMerchantName,
        merchantName: this.config.merchantName
      };

      const response = await this.makeApiCall('POST', url, refundData);

      return {
        success: true,
        transactionId: clientCorrelator,
        message: `Refund of $${amount} processed successfully`,
        rawResponse: response
      };

    } catch (error) {
      console.error('EcoCash refund failed:', error);
      return {
        success: false,
        message: 'Refund processing failed',
        errorCode: 'REFUND_FAILED'
      };
    }
  }

  /**
   * Make API call with proper authentication
   */
  private async makeApiCall(method: 'GET' | 'POST', url: string, data?: any): Promise<any> {
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    };

    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`EcoCash API error: ${response.status} - ${JSON.stringify(result)}`);
    }

    return result;
  }

  /**
   * Generate client correlator (equivalent to Ruby generated_client_correlator)
   */
  private generateClientCorrelator(): string {
    const now = new Date();
    const prefix = this.config.clientCorrelatorPrefix.substring(0, 7);
    const timestamp = [
      now.getDate().toString().padStart(2, '0'),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getFullYear().toString(),
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0'),
      now.getMilliseconds().toString().padStart(3, '0'),
      Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    ].join('');
    
    return `${prefix}${timestamp}`;
  }

  /**
   * Simulation methods for development/testing
   */
  private async simulatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const transactionId = this.generateClientCorrelator();
    
    this.pendingTransactions.set(transactionId, {
      ...request,
      transactionId,
      status: 'pending',
      timestamp: new Date()
    });

    // Simulate completion after 3 seconds
    setTimeout(() => {
      const transaction = this.pendingTransactions.get(transactionId);
      if (transaction) {
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        console.log(`✅ Simulated EcoCash payment completed: ${transactionId}`);
      }
    }, 3000);

    return {
      success: true,
      transactionId,
      message: `SIMULATION: Payment request sent to ${request.phoneNumber}. Will complete in 3 seconds.`
    };
  }

  private simulateRefund(amount: number): PaymentResponse {
    return {
      success: true,
      transactionId: this.generateClientCorrelator(),
      message: `SIMULATION: Refund of $${amount} processed successfully`
    };
  }

  private getSimulatedStatus(clientCorrelator: string): any {
    const transaction = this.pendingTransactions.get(clientCorrelator);
    return transaction || null;
  }

  /**
   * Get configuration status for admin dashboard
   */
  public getConfigurationStatus(): any {
    return {
      configured: this.isConfigured(),
      apiBaseUrl: this.config.apiBaseUrl,
      merchantName: this.config.merchantName,
      hasUsername: !!this.config.username,
      hasPassword: !!this.config.password,
      hasMerchantCode: !!this.config.merchantCode,
      hasMerchantNumber: !!this.config.merchantNumber,
      hasMerchantPin: !!this.config.merchantPin,
      mode: this.isConfigured() ? 'PRODUCTION' : 'SIMULATION'
    };
  }

  /**
   * Get pending transactions for monitoring
   */
  public getPendingTransactions(): any[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Process webhook callback from EcoCash
   */
  public processCallback(callbackData: any): void {
    try {
      const { clientCorrelator, transactionOperationStatus } = callbackData;
      
      if (clientCorrelator && this.pendingTransactions.has(clientCorrelator)) {
        const transaction = this.pendingTransactions.get(clientCorrelator);
        
        switch (transactionOperationStatus) {
          case 'CHARGED':
            transaction.status = 'completed';
            break;
          case 'FAILED':
            transaction.status = 'failed';
            break;
          case 'CANCELLED':
            transaction.status = 'cancelled';
            break;
        }
        
        transaction.completedAt = new Date();
        transaction.callbackData = callbackData;
        
        console.log(`📱 EcoCash callback processed: ${clientCorrelator} -> ${transaction.status}`);
      }
    } catch (error) {
      console.error('EcoCash callback processing failed:', error);
    }
  }
}

export const realEcoCashService = RealEcoCashService.getInstance();