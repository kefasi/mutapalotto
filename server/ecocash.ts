import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';

interface EcoCashConfig {
  apiBaseUrl: string;
  username: string;
  password: string;
  merchantNumber: string;
  merchantCode: string;
  merchantPin: string;
  description: string;
  onBehalfOf: string;
  paymentRemarks: string;
  referenceCode: string;
  purchaseCategoryCode: string;
  refundRemarks: string;
  superMerchantName: string;
  merchantName: string;
  terminalId: string;
  location: string;
  notifyUrl: string;
  currencyCode: string;
  countryCode: string;
  clientCorrelatorPrefix: string;
}

interface PaymentRequest {
  msisdn: string;
  amount: number;
  description?: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  clientCorrelator?: string;
  message?: string;
  error?: string;
}

interface TransactionStatus {
  transactionId: string;
  status: string;
  amount: number;
  msisdn: string;
  timestamp: string;
}

export class EcoCashService {
  private static instance: EcoCashService;
  private config: EcoCashConfig;

  private constructor() {
    this.config = {
      apiBaseUrl: process.env.ECOCASH_API_BASE_URL || 'https://api.ecocash.co.zw/v1',
      username: process.env.ECOCASH_USERNAME || '',
      password: process.env.ECOCASH_PASSWORD || '',
      merchantNumber: process.env.ECOCASH_MERCHANT_NUMBER || '',
      merchantCode: process.env.ECOCASH_MERCHANT_CODE || '',
      merchantPin: process.env.ECOCASH_MERCHANT_PIN || '',
      description: 'Mutapa Lottery Payment',
      onBehalfOf: 'Mutapa Lottery Platform',
      paymentRemarks: 'Lottery ticket purchase',
      referenceCode: 'MUTAPA',
      purchaseCategoryCode: 'Online Payment',
      refundRemarks: 'Lottery refund',
      superMerchantName: process.env.ECOCASH_SUPER_MERCHANT_NAME || '',
      merchantName: process.env.ECOCASH_MERCHANT_NAME || 'Mutapa Lottery',
      terminalId: 'MUTAPA_WEB',
      location: 'Zimbabwe',
      notifyUrl: process.env.ECOCASH_NOTIFY_URL || `${process.env.BASE_URL}/api/ecocash/callback`,
      currencyCode: 'USD',
      countryCode: 'ZW',
      clientCorrelatorPrefix: 'MUTAPA'
    };
  }

  public static getInstance(): EcoCashService {
    if (!EcoCashService.instance) {
      EcoCashService.instance = new EcoCashService();
    }
    return EcoCashService.instance;
  }

  private generateClientCorrelator(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 17);
    return `${this.config.clientCorrelatorPrefix}${timestamp}`;
  }

  private getAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  public async chargeSubscriber(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const clientCorrelator = this.generateClientCorrelator();
      const url = `${this.config.apiBaseUrl}/transactions/amount`;
      
      const payload = {
        clientCorrelator,
        notifyUrl: this.config.notifyUrl,
        referenceCode: this.config.referenceCode,
        tranType: 'MER',
        endUserId: request.msisdn,
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

      const response: AxiosResponse = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        }
      });

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          transactionId: response.data.transactionId,
          clientCorrelator,
          message: 'Payment initiated successfully'
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Payment failed'
        };
      }
    } catch (error: any) {
      console.error('EcoCash payment error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Payment processing failed'
      };
    }
  }

  public async getTransactionStatus(msisdn: string, clientCorrelator: string): Promise<TransactionStatus | null> {
    try {
      const url = `${this.config.apiBaseUrl}/${msisdn}/transactions/amount/${clientCorrelator}`;
      
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        }
      });

      if (response.status === 200 && response.data) {
        return {
          transactionId: response.data.transactionId,
          status: response.data.transactionOperationStatus,
          amount: response.data.paymentAmount?.charginginformation?.amount || 0,
          msisdn: response.data.endUserId,
          timestamp: response.data.timestamp || new Date().toISOString()
        };
      }
      return null;
    } catch (error: any) {
      console.error('EcoCash status check error:', error);
      return null;
    }
  }

  public async refundTransaction(msisdn: string, transactionId: string, amount: number): Promise<PaymentResponse> {
    try {
      const clientCorrelator = this.generateClientCorrelator();
      const url = `${this.config.apiBaseUrl}/transactions/refund`;
      
      const payload = {
        clientCorrelator,
        referenceCode: this.config.referenceCode,
        tranType: 'REF',
        endUserId: msisdn,
        originalEcocashReference: transactionId,
        remark: this.config.refundRemarks,
        paymentAmount: {
          charginginformation: {
            amount,
            currency: this.config.currencyCode,
            description: this.config.description
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

      const response: AxiosResponse = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        }
      });

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          transactionId: response.data.transactionId,
          clientCorrelator,
          message: 'Refund processed successfully'
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Refund failed'
        };
      }
    } catch (error: any) {
      console.error('EcoCash refund error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Refund processing failed'
      };
    }
  }

  public async listTransactions(msisdn: string): Promise<TransactionStatus[]> {
    try {
      const url = `${this.config.apiBaseUrl}/${msisdn}/transactions`;
      
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader()
        }
      });

      if (response.status === 200 && response.data?.transactions) {
        return response.data.transactions.map((tx: any) => ({
          transactionId: tx.transactionId,
          status: tx.transactionOperationStatus,
          amount: tx.paymentAmount?.charginginformation?.amount || 0,
          msisdn: tx.endUserId,
          timestamp: tx.timestamp || new Date().toISOString()
        }));
      }
      return [];
    } catch (error: any) {
      console.error('EcoCash transaction list error:', error);
      return [];
    }
  }

  public validateConfig(): boolean {
    const requiredFields = [
      'username', 'password', 'merchantNumber', 
      'merchantCode', 'merchantPin', 'apiBaseUrl'
    ];
    
    return requiredFields.every(field => 
      this.config[field as keyof EcoCashConfig] && 
      this.config[field as keyof EcoCashConfig].toString().length > 0
    );
  }
}

export const ecocashService = EcoCashService.getInstance();