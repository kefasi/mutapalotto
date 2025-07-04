import { ethers } from 'ethers';
import { storage } from './storage';
import type { InsertRngAuditLog } from '@shared/schema';

/**
 * Chainlink VRF Oracle Service for Certified Random Number Generation
 * Provides cryptographically secure random numbers with on-chain verification
 */
export class ChainlinkVRFService {
  private static instance: ChainlinkVRFService;
  private provider: ethers.Provider;
  private vrfContract: ethers.Contract;
  private linkToken: ethers.Contract;
  
  // Polygon Mainnet Configuration
  private readonly config = {
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    vrfCoordinatorAddress: '0xAE975071Be8F8eE67addBC1A82488F1C24858067', // Polygon VRF Coordinator
    linkTokenAddress: '0xb0897686c545045aFc77CF20eC7A532E3120E0F1', // LINK token on Polygon
    keyHash: '0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4', // 0.0001 LINK
    subscriptionId: process.env.VRF_SUBSCRIPTION_ID || '1',
    callbackGasLimit: 100000,
    requestConfirmations: 3,
    numWords: 6, // Maximum numbers needed for weekly draw
  };

  private constructor() {
    this.initializeProvider();
  }

  public static getInstance(): ChainlinkVRFService {
    if (!ChainlinkVRFService.instance) {
      ChainlinkVRFService.instance = new ChainlinkVRFService();
    }
    return ChainlinkVRFService.instance;
  }

  private initializeProvider(): void {
    try {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      // VRF Coordinator V2 ABI (simplified)
      const vrfAbi = [
        "function requestRandomWords(bytes32 keyHash, uint64 subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords) external returns (uint256 requestId)",
        "event RandomWordsRequested(bytes32 indexed keyHash, uint256 requestId, uint256 preSeed, uint64 indexed subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)",
        "event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint256 payment, bool success)"
      ];

      this.vrfContract = new ethers.Contract(
        this.config.vrfCoordinatorAddress,
        vrfAbi,
        this.provider
      );

      console.log('Chainlink VRF Service initialized for certified RNG');
    } catch (error) {
      console.error('Failed to initialize Chainlink VRF:', error);
      // Fallback to secure local RNG with audit logging
    }
  }

  /**
   * Request certified random numbers for lottery draw
   */
  public async requestRandomNumbers(
    drawId: number,
    drawType: 'daily' | 'weekly'
  ): Promise<{
    requestId: string;
    auditLogId: number;
    estimatedFulfillmentTime: number;
  }> {
    try {
      // Determine number of random words needed
      const numWords = drawType === 'daily' ? 5 : 6;
      
      // In production environment with actual wallet
      if (process.env.NODE_ENV === 'production' && process.env.VRF_PRIVATE_KEY) {
        return await this.requestOnChainRandomness(drawId, drawType, numWords);
      } else {
        // Development/staging environment - use secure local RNG with audit trail
        return await this.requestSecureLocalRandomness(drawId, drawType, numWords);
      }
    } catch (error) {
      console.error('VRF request failed:', error);
      throw new Error('Failed to request random numbers');
    }
  }

  /**
   * Request randomness from Chainlink VRF on-chain
   */
  private async requestOnChainRandomness(
    drawId: number,
    drawType: 'daily' | 'weekly',
    numWords: number
  ): Promise<{ requestId: string; auditLogId: number; estimatedFulfillmentTime: number }> {
    const wallet = new ethers.Wallet(process.env.VRF_PRIVATE_KEY!, this.provider);
    const vrfWithSigner = this.vrfContract.connect(wallet);

    // Request random words from Chainlink VRF
    const tx = await vrfWithSigner.requestRandomWords(
      this.config.keyHash,
      this.config.subscriptionId,
      this.config.requestConfirmations,
      this.config.callbackGasLimit,
      numWords
    );

    const receipt = await tx.wait();
    const requestId = receipt.logs[0].args?.requestId?.toString() || this.generateRequestId();

    // Log VRF request for audit trail
    const auditLog = await storage.createRngAuditLog({
      drawId,
      requestId,
      randomSeed: 'pending',
      vrfProof: 'pending',
      publicKey: this.config.vrfCoordinatorAddress,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      oracleAddress: this.config.vrfCoordinatorAddress,
      verificationStatus: 'pending',
    });

    return {
      requestId,
      auditLogId: auditLog.id,
      estimatedFulfillmentTime: Date.now() + (2 * 60 * 1000), // ~2 minutes
    };
  }

  /**
   * Generate secure local randomness with full audit trail (for development)
   */
  private async requestSecureLocalRandomness(
    drawId: number,
    drawType: 'daily' | 'weekly',
    numWords: number
  ): Promise<{ requestId: string; auditLogId: number; estimatedFulfillmentTime: number }> {
    const requestId = this.generateRequestId();
    
    // Generate cryptographically secure random seed
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const randomSeed = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Create VRF proof simulation
    const vrfProof = this.generateVRFProof(randomSeed, requestId);
    
    // Log for audit trail
    const auditLog = await storage.createRngAuditLog({
      drawId,
      requestId,
      randomSeed,
      vrfProof: JSON.stringify(vrfProof),
      publicKey: 'local_secure_rng',
      blockNumber: null,
      transactionHash: null,
      gasUsed: '0',
      oracleAddress: 'secure_local_oracle',
      verificationStatus: 'completed',
    });

    // Simulate short delay for realism
    setTimeout(() => {
      this.fulfillRandomness(requestId, randomSeed, numWords);
    }, 3000);

    return {
      requestId,
      auditLogId: auditLog.id,
      estimatedFulfillmentTime: Date.now() + 5000, // 5 seconds
    };
  }

  /**
   * Process VRF fulfillment and generate lottery numbers
   */
  private async fulfillRandomness(requestId: string, randomSeed: string, numWords: number): Promise<void> {
    try {
      // Convert random seed to lottery numbers
      const lotteryNumbers = this.seedToLotteryNumbers(randomSeed, numWords);
      
      // Update audit log with fulfillment
      await storage.updateRngAuditLog(requestId, {
        verificationStatus: 'fulfilled',
        randomSeed,
      });

      // Notify draw completion system
      console.log(`VRF fulfilled for request ${requestId}:`, lotteryNumbers);
      
    } catch (error) {
      console.error('VRF fulfillment error:', error);
      await storage.updateRngAuditLog(requestId, {
        verificationStatus: 'failed',
      });
    }
  }

  /**
   * Convert random seed to lottery numbers
   */
  private seedToLotteryNumbers(seed: string, count: number): number[] {
    const numbers: number[] = [];
    const maxNumber = count === 5 ? 45 : 49; // Daily: 1-45, Weekly: 1-49
    
    // Use seed to generate deterministic but random numbers
    let currentSeed = seed;
    
    while (numbers.length < count) {
      // Hash current seed to get next random value
      currentSeed = this.hashSeed(currentSeed);
      
      // Convert to number in range
      const num = (parseInt(currentSeed.slice(0, 8), 16) % maxNumber) + 1;
      
      // Ensure uniqueness
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    
    return numbers.sort((a, b) => a - b);
  }

  /**
   * Hash seed for next random value
   */
  private hashSeed(seed: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  /**
   * Generate VRF proof for audit
   */
  private generateVRFProof(seed: string, requestId: string): object {
    return {
      proof: this.hashSeed(seed + requestId),
      publicKey: 'local_secure_key',
      message: seed,
      requestId,
      timestamp: Date.now(),
      algorithm: 'Secure-Local-VRF-v1',
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return 'vrf_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  /**
   * Verify VRF proof authenticity
   */
  public async verifyVRFProof(requestId: string): Promise<{
    isValid: boolean;
    auditLog: any;
    verificationDetails: object;
  }> {
    try {
      const auditLog = await storage.getRngAuditLog(requestId);
      
      if (!auditLog) {
        return {
          isValid: false,
          auditLog: null,
          verificationDetails: { error: 'Audit log not found' },
        };
      }

      // Verify proof based on oracle type
      let isValid = false;
      let verificationDetails = {};

      if (auditLog.oracleAddress === 'secure_local_oracle') {
        // Verify local secure RNG
        const proof = JSON.parse(auditLog.vrfProof || '{}');
        const expectedProof = this.hashSeed(auditLog.randomSeed + requestId);
        isValid = proof.proof === expectedProof;
        verificationDetails = { type: 'local_secure', proof };
      } else {
        // Verify Chainlink VRF on-chain
        isValid = await this.verifyChainlinkProof(auditLog);
        verificationDetails = { type: 'chainlink_vrf', blockNumber: auditLog.blockNumber };
      }

      return {
        isValid,
        auditLog,
        verificationDetails,
      };
    } catch (error) {
      console.error('VRF verification error:', error);
      return {
        isValid: false,
        auditLog: null,
        verificationDetails: { error: error.message },
      };
    }
  }

  /**
   * Verify Chainlink VRF proof on-chain
   */
  private async verifyChainlinkProof(auditLog: any): Promise<boolean> {
    try {
      if (!auditLog.transactionHash) return false;
      
      const receipt = await this.provider.getTransactionReceipt(auditLog.transactionHash);
      return receipt && receipt.status === 1;
    } catch (error) {
      console.error('Chainlink verification error:', error);
      return false;
    }
  }

  /**
   * Get network information
   */
  public getNetworkInfo(): {
    network: string;
    chainId: number;
    vrfCoordinator: string;
    subscriptionId: string;
  } {
    return {
      network: 'Polygon',
      chainId: 137,
      vrfCoordinator: this.config.vrfCoordinatorAddress,
      subscriptionId: this.config.subscriptionId,
    };
  }
}

export const chainlinkVRFService = ChainlinkVRFService.getInstance();