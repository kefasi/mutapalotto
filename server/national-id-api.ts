import axios, { AxiosResponse } from 'axios';

interface ZimbabweIdConfig {
  apiBaseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  verificationEndpoint: string;
  authEndpoint: string;
  timeout: number;
}

interface NationalIdRequest {
  nationalId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
}

interface NationalIdResponse {
  success: boolean;
  verified: boolean;
  nationalId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  placeOfBirth: string;
  address?: string;
  issuedDate: string;
  expiryDate?: string;
  status: 'active' | 'inactive' | 'suspended' | 'expired';
  verificationScore: number; // 0-100 confidence score
  matchedFields: string[];
  failureReason?: string;
  responseTime: number;
  apiReference: string;
}

interface ApiAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class ZimbabweNationalIdService {
  private static instance: ZimbabweNationalIdService;
  private config: ZimbabweIdConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  private constructor() {
    this.config = {
      apiBaseUrl: process.env.ZIMBABWE_ID_API_URL || 'https://api.zimregistry.gov.zw',
      apiKey: process.env.ZIMBABWE_ID_API_KEY || '',
      clientId: process.env.ZIMBABWE_ID_CLIENT_ID || '',
      clientSecret: process.env.ZIMBABWE_ID_CLIENT_SECRET || '',
      verificationEndpoint: '/v1/identity/verify',
      authEndpoint: '/v1/auth/token',
      timeout: 30000, // 30 seconds
    };
  }

  public static getInstance(): ZimbabweNationalIdService {
    if (!ZimbabweNationalIdService.instance) {
      ZimbabweNationalIdService.instance = new ZimbabweNationalIdService();
    }
    return ZimbabweNationalIdService.instance;
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response: AxiosResponse<ApiAuthResponse> = await axios.post(
        `${this.config.apiBaseUrl}${this.config.authEndpoint}`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-API-Key': this.config.apiKey,
          },
          timeout: this.config.timeout,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      return this.accessToken;
    } catch (error) {
      console.error('Zimbabwe ID API authentication failed:', error);
      throw new Error('Failed to authenticate with Zimbabwe National ID API');
    }
  }

  public async verifyNationalId(request: NationalIdRequest): Promise<NationalIdResponse> {
    const startTime = Date.now();
    
    try {
      // Validate national ID format (Zimbabwe format: 12-345678-A12)
      if (!this.isValidZimbabweIdFormat(request.nationalId)) {
        return {
          success: false,
          verified: false,
          nationalId: request.nationalId,
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          gender: '',
          placeOfBirth: '',
          issuedDate: '',
          status: 'inactive',
          verificationScore: 0,
          matchedFields: [],
          failureReason: 'Invalid national ID format',
          responseTime: Date.now() - startTime,
          apiReference: `ZW_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
      }

      const accessToken = await this.authenticate();

      const response: AxiosResponse = await axios.post(
        `${this.config.apiBaseUrl}${this.config.verificationEndpoint}`,
        {
          national_id: request.nationalId,
          first_name: request.firstName,
          last_name: request.lastName,
          date_of_birth: request.dateOfBirth,
          phone_number: request.phoneNumber,
          verification_type: 'comprehensive',
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
          timeout: this.config.timeout,
        }
      );

      const apiData = response.data;
      
      return {
        success: true,
        verified: apiData.verified === true,
        nationalId: apiData.national_id,
        firstName: apiData.first_name || '',
        lastName: apiData.last_name || '',
        dateOfBirth: apiData.date_of_birth || '',
        gender: apiData.gender || '',
        placeOfBirth: apiData.place_of_birth || '',
        address: apiData.address,
        issuedDate: apiData.issued_date || '',
        expiryDate: apiData.expiry_date,
        status: apiData.status || 'active',
        verificationScore: apiData.verification_score || 0,
        matchedFields: apiData.matched_fields || [],
        responseTime: Date.now() - startTime,
        apiReference: apiData.reference || `ZW_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    } catch (error: any) {
      console.error('Zimbabwe ID API verification failed:', error);
      
      let failureReason = 'API verification failed';
      if (error.response?.status === 404) {
        failureReason = 'National ID not found in database';
      } else if (error.response?.status === 429) {
        failureReason = 'Rate limit exceeded, please try again later';
      } else if (error.code === 'ECONNABORTED') {
        failureReason = 'Verification request timed out';
      } else if (error.response?.data?.message) {
        failureReason = error.response.data.message;
      }

      return {
        success: false,
        verified: false,
        nationalId: request.nationalId,
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
        placeOfBirth: '',
        issuedDate: '',
        status: 'inactive',
        verificationScore: 0,
        matchedFields: [],
        failureReason,
        responseTime: Date.now() - startTime,
        apiReference: `ZW_ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    }
  }

  private isValidZimbabweIdFormat(nationalId: string): boolean {
    // Zimbabwe National ID format: 12-345678-A12
    // 12 = district code (2 digits)
    // 345678 = sequence number (6 digits)
    // A = check letter
    // 12 = year of birth (2 digits)
    const pattern = /^\d{2}-\d{6}-[A-Z]\d{2}$/;
    return pattern.test(nationalId);
  }

  public async batchVerify(requests: NationalIdRequest[]): Promise<NationalIdResponse[]> {
    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    const results: NationalIdResponse[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.verifyNationalId(request));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            verified: false,
            nationalId: batch[index].nationalId,
            firstName: '',
            lastName: '',
            dateOfBirth: '',
            gender: '',
            placeOfBirth: '',
            issuedDate: '',
            status: 'inactive',
            verificationScore: 0,
            matchedFields: [],
            failureReason: 'Batch processing error',
            responseTime: 0,
            apiReference: `ZW_BATCH_ERR_${Date.now()}`,
          });
        }
      });
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  public async getApiStatus(): Promise<{ status: string; responseTime: number; available: boolean }> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${this.config.apiBaseUrl}/health`, {
        headers: {
          'X-API-Key': this.config.apiKey,
        },
        timeout: 10000,
      });
      
      return {
        status: response.data.status || 'unknown',
        responseTime: Date.now() - startTime,
        available: response.status === 200,
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        available: false,
      };
    }
  }

  public validateConfig(): boolean {
    return !!(
      this.config.apiBaseUrl &&
      this.config.apiKey &&
      this.config.clientId &&
      this.config.clientSecret
    );
  }
}

export const zimbabweNationalIdService = ZimbabweNationalIdService.getInstance();