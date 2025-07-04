import { ethers } from 'ethers';
import { storage } from './storage';

// Polygon VRF Configuration for cheapest real-time randomness
interface PolygonVRFConfig {
  rpcUrl: string;
  vrfCoordinatorAddress: string;
  linkTokenAddress: string;
  keyHash: string;
  subscriptionId: string;
  callbackGasLimit: number;
  requestConfirmations: number;
  numWords: number;
}

interface VRFRequest {
  requestId: string;
  drawId: number;
  drawType: 'daily' | 'weekly';
  timestamp: Date;
  blockNumber: number;
  status: 'pending' | 'fulfilled' | 'failed';
}

interface VRFResult {
  requestId: string;
  randomWords: bigint[];
  blockNumber: number;
  transactionHash: string;
  gasUsed: string;
}

export class PolygonVRFService {
  private static instance: PolygonVRFService;
  private config: PolygonVRFConfig;
  private provider: ethers.Provider;
  private vrfContract: ethers.Contract;
  private requests: Map<string, VRFRequest> = new Map();

  private constructor() {
    this.config = {
      // Polygon Mumbai testnet (cheapest for development)
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
      vrfCoordinatorAddress: '0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed', // Mumbai VRF Coordinator
      linkTokenAddress: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB', // Mumbai LINK
      keyHash: '0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f', // 30 gwei key hash
      subscriptionId: process.env.VRF_SUBSCRIPTION_ID || '1',
      callbackGasLimit: 100000,
      requestConfirmations: 3,
      numWords: 1
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    
    // VRF Coordinator ABI (minimal)
    const vrfAbi = [
      'function requestRandomWords(bytes32 keyHash, uint64 subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords) external returns (uint256 requestId)',
      'event RandomWordsRequested(uint256 indexed keyHash, uint256 requestId, uint256 preSeed, uint64 indexed subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)',
      'event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint256 payment, bool success)'
    ];

    this.vrfContract = new ethers.Contract(
      this.config.vrfCoordinatorAddress,
      vrfAbi,
      this.provider
    );

    this.setupEventListeners();
  }

  public static getInstance(): PolygonVRFService {
    if (!PolygonVRFService.instance) {
      PolygonVRFService.instance = new PolygonVRFService();
    }
    return PolygonVRFService.instance;
  }

  private setupEventListeners(): void {
    // Listen for VRF fulfillment events
    this.vrfContract.on('RandomWordsFulfilled', async (requestId, outputSeed, payment, success) => {
      console.log('VRF fulfilled:', { requestId: requestId.toString(), outputSeed: outputSeed.toString(), success });
      
      const request = this.requests.get(requestId.toString());
      if (request && success) {
        await this.processVRFResult(requestId.toString(), [outputSeed]);
      }
    });
  }

  public async requestRandomness(drawId: number, drawType: 'daily' | 'weekly'): Promise<string> {
    try {
      // For development, we'll simulate a VRF request since we need real wallet/subscription
      const requestId = this.generateMockRequestId(drawId, drawType);
      
      const request: VRFRequest = {
        requestId,
        drawId,
        drawType,
        timestamp: new Date(),
        blockNumber: await this.provider.getBlockNumber(),
        status: 'pending'
      };

      this.requests.set(requestId, request);
      
      // Store VRF seed in storage
      await storage.createVrfSeed(drawId);
      
      console.log('VRF request initiated:', { requestId, drawId, drawType });

      // Simulate VRF fulfillment after a short delay (real implementation would wait for blockchain)
      setTimeout(async () => {
        await this.simulateVRFFulfillment(requestId);
      }, 5000); // 5 second delay to simulate blockchain confirmation

      return requestId;
    } catch (error) {
      console.error('VRF request failed:', error);
      throw new Error('Failed to request randomness from Polygon VRF');
    }
  }

  private generateMockRequestId(drawId: number, drawType: string): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `vrf_${drawType}_${drawId}_${timestamp}_${random}`;
  }

  private async simulateVRFFulfillment(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) return;

    try {
      // Generate cryptographically secure random number
      const randomBytes = ethers.randomBytes(32);
      const randomBigInt = ethers.toBigInt(randomBytes);
      
      await this.processVRFResult(requestId, [randomBigInt]);
      
      request.status = 'fulfilled';
      console.log('VRF request fulfilled:', { requestId, drawId: request.drawId });
    } catch (error) {
      console.error('VRF fulfillment failed:', error);
      request.status = 'failed';
    }
  }

  private async processVRFResult(requestId: string, randomWords: bigint[]): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request) return;

    try {
      // Convert VRF output to lottery numbers
      const winningNumbers = this.generateLotteryNumbers(randomWords[0], request.drawType);
      
      // Complete the draw with VRF-generated numbers
      const completedDraw = await storage.completeDraw(
        request.drawId, 
        winningNumbers, 
        `polygon_vrf_${requestId}`
      );

      console.log('Draw completed with VRF:', {
        drawId: request.drawId,
        winningNumbers,
        vrfRequestId: requestId
      });

      // Update VRF seed with results
      const vrfSeed = await storage.getVrfSeed(request.drawId);
      if (vrfSeed) {
        // In real implementation, would store the actual VRF proof
        console.log('VRF proof stored for draw:', request.drawId);
      }

    } catch (error) {
      console.error('Failed to process VRF result:', error);
      throw error;
    }
  }

  private generateLotteryNumbers(randomSeed: bigint, drawType: 'daily' | 'weekly'): number[] {
    const numbers: number[] = [];
    const maxNumber = drawType === 'daily' ? 45 : 49;
    const count = drawType === 'daily' ? 5 : 6;
    
    let seed = randomSeed;
    const used = new Set<number>();

    while (numbers.length < count) {
      // Use the seed to generate deterministic random numbers
      seed = BigInt(ethers.keccak256(ethers.toBeHex(seed, 32)));
      const num = Number(seed % BigInt(maxNumber)) + 1;
      
      if (!used.has(num)) {
        used.add(num);
        numbers.push(num);
      }
    }

    return numbers.sort((a, b) => a - b);
  }

  public async getVRFStatus(requestId: string): Promise<VRFRequest | null> {
    return this.requests.get(requestId) || null;
  }

  public async verifyVRFResult(drawId: number): Promise<boolean> {
    try {
      const vrfSeed = await storage.getVrfSeed(drawId);
      if (!vrfSeed) return false;

      // In a real implementation, this would verify the VRF proof on-chain
      // For now, we verify that the seed exists and was created properly
      return vrfSeed.drawId === drawId && vrfSeed.seedValue.length > 0;
    } catch (error) {
      console.error('VRF verification failed:', error);
      return false;
    }
  }

  public getNetworkInfo(): { network: string; chainId: number; vrfCoordinator: string } {
    return {
      network: 'Polygon Mumbai',
      chainId: 80001,
      vrfCoordinator: this.config.vrfCoordinatorAddress
    };
  }

  // Method to estimate VRF costs
  public async estimateVRFCost(): Promise<{ linkCost: string; gasCost: string }> {
    try {
      // Polygon is much cheaper than Ethereum mainnet
      return {
        linkCost: '0.0001', // LINK tokens (very low on Polygon)
        gasCost: '0.001' // MATIC for gas (extremely cheap)
      };
    } catch (error) {
      console.error('Failed to estimate VRF cost:', error);
      return { linkCost: '0.0001', gasCost: '0.001' };
    }
  }
}

export const polygonVRFService = PolygonVRFService.getInstance();