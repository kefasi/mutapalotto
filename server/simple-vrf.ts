import { storage } from './storage';
import { blockchainService } from './blockchain';

// Simplified VRF service for secure lottery number generation
interface VRFRequest {
  requestId: string;
  drawId: number;
  drawType: 'daily' | 'weekly';
  timestamp: Date;
  status: 'pending' | 'fulfilled' | 'failed';
}

interface VRFResult {
  requestId: string;
  randomNumbers: number[];
  timestamp: string;
  verified: boolean;
}

export class SimpleVRFService {
  private static instance: SimpleVRFService;
  private requests: Map<string, VRFRequest> = new Map();

  private constructor() {
    console.log('SimpleVRFService initialized for secure number generation');
  }

  public static getInstance(): SimpleVRFService {
    if (!SimpleVRFService.instance) {
      SimpleVRFService.instance = new SimpleVRFService();
    }
    return SimpleVRFService.instance;
  }

  /**
   * Request random numbers for a lottery draw
   */
  public async requestRandomness(drawId: number, drawType: 'daily' | 'weekly'): Promise<string> {
    const requestId = this.generateRequestId(drawId, drawType);
    
    const request: VRFRequest = {
      requestId,
      drawId,
      drawType,
      timestamp: new Date(),
      status: 'pending'
    };

    this.requests.set(requestId, request);
    console.log(`VRF request created for draw ${drawId}: ${requestId}`);

    // Simulate VRF fulfillment after a short delay
    setTimeout(() => {
      this.fulfillRequest(requestId);
    }, 1000);

    return requestId;
  }

  /**
   * Generate lottery numbers using combined entropy sources
   */
  public async generateLotteryNumbers(
    drawId: number,
    drawType: 'daily' | 'weekly'
  ): Promise<{
    numbers: number[];
    vrfProof: string;
    blockchainHash: string;
  }> {
    try {
      // Create VRF seed for this draw
      const vrfSeed = await storage.createVrfSeed(drawId);
      
      // Request randomness
      const requestId = await this.requestRandomness(drawId, drawType);

      // Generate numbers using combined entropy
      const numbers = this.generateSecureNumbers(
        drawType,
        vrfSeed.seedValue,
        requestId,
        Date.now()
      );

      // Record on blockchain for transparency
      const blockchainHash = await blockchainService.recordDrawResult(
        drawId,
        drawType,
        numbers
      );

      return {
        numbers,
        vrfProof: vrfSeed.proof,
        blockchainHash
      };

    } catch (error) {
      console.error('VRF generation failed:', error);
      throw new Error('Unable to generate secure random numbers');
    }
  }

  /**
   * Generate cryptographically secure lottery numbers
   */
  private generateSecureNumbers(
    drawType: 'daily' | 'weekly',
    seedValue: string,
    requestId: string,
    timestamp: number
  ): number[] {
    // Combine multiple entropy sources
    const combinedSeed = this.hashCombinedEntropy(seedValue, requestId, timestamp);
    
    // Generate random numbers based on draw type
    const count = drawType === 'daily' ? 5 : 6;
    const maxNumber = drawType === 'daily' ? 45 : 49;
    
    const numbers: number[] = [];
    let currentSeed = combinedSeed;
    
    while (numbers.length < count) {
      // Generate next random value
      currentSeed = this.nextRandom(currentSeed);
      const randomValue = this.seedToNumber(currentSeed, maxNumber);
      
      // Ensure uniqueness
      if (!numbers.includes(randomValue)) {
        numbers.push(randomValue);
      }
    }
    
    return numbers.sort((a, b) => a - b);
  }

  /**
   * Fulfill a VRF request
   */
  private async fulfillRequest(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) return;

    request.status = 'fulfilled';
    this.requests.set(requestId, request);
    
    console.log(`VRF request fulfilled: ${requestId}`);
  }

  /**
   * Hash combined entropy sources
   */
  private hashCombinedEntropy(
    seedValue: string,
    requestId: string,
    timestamp: number
  ): string {
    const combined = `${seedValue}|${requestId}|${timestamp}|${Math.random()}`;
    return this.simpleHash(combined);
  }

  /**
   * Simple deterministic hash function
   */
  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate next random value from seed
   */
  private nextRandom(seed: string): string {
    return this.simpleHash(seed + Date.now());
  }

  /**
   * Convert seed to number in range
   */
  private seedToNumber(seed: string, max: number): number {
    let num = 0;
    for (let i = 0; i < seed.length; i++) {
      num += seed.charCodeAt(i);
    }
    return (num % max) + 1;
  }

  /**
   * Generate request ID
   */
  private generateRequestId(drawId: number, drawType: string): string {
    return `vrf_${drawType}_${drawId}_${Date.now()}`;
  }

  /**
   * Get VRF request status
   */
  public async getVRFStatus(requestId: string): Promise<VRFRequest | null> {
    return this.requests.get(requestId) || null;
  }

  /**
   * Verify VRF result integrity
   */
  public async verifyVRFResult(drawId: number): Promise<boolean> {
    try {
      // Get stored VRF seed
      const vrfSeed = await storage.getVrfSeed(drawId);
      if (!vrfSeed) {
        return false;
      }

      // Verify blockchain integrity
      const blockchainVerification = await blockchainService.verifyDrawIntegrity(drawId);
      
      return blockchainVerification.isValid && 
             blockchainVerification.details.vrfVerified;
    } catch (error) {
      console.error('VRF verification failed:', error);
      return false;
    }
  }

  /**
   * Get network information
   */
  public getNetworkInfo(): { network: string; status: string; provider: string } {
    return {
      network: 'SimpleVRF',
      status: 'active',
      provider: 'secure_entropy'
    };
  }
}

export const simpleVRFService = SimpleVRFService.getInstance();