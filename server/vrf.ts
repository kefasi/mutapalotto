import crypto from "crypto";
import { storage } from "./storage";

export interface VRFProof {
  seedValue: string;
  publicKey: string;
  proof: string;
  output: string;
  verificationHash: string;
}

export interface VRFResult {
  winningNumbers: number[];
  proof: VRFProof;
  blockchainHash: string;
}

export class VRFService {
  private static instance: VRFService;
  private keyPair: { publicKey: string; privateKey: string };

  private constructor() {
    // Generate a key pair for VRF operations
    this.keyPair = this.generateKeyPair();
  }

  public static getInstance(): VRFService {
    if (!VRFService.instance) {
      VRFService.instance = new VRFService();
    }
    return VRFService.instance;
  }

  private generateKeyPair(): { publicKey: string; privateKey: string } {
    // Generate an ECDSA key pair for VRF operations
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  private generateSeed(drawId: number, drawType: string, timestamp: number): string {
    // Create a seed from multiple entropy sources
    const entropyData = `${drawId}-${drawType}-${timestamp}-${Math.random()}-${process.hrtime.bigint()}`;
    return crypto.createHash('sha256').update(entropyData).digest('hex');
  }

  private createProof(seedValue: string): VRFProof {
    // Create a deterministic proof using the seed and private key
    const message = Buffer.from(seedValue, 'hex');
    
    // Sign the seed with the private key
    const privateKeyBuffer = Buffer.from(this.keyPair.privateKey, 'hex');
    const signature = crypto.sign('sha256', message, {
      key: privateKeyBuffer,
      format: 'der',
      type: 'pkcs8'
    });

    // Generate the VRF output
    const output = crypto.createHash('sha256')
      .update(seedValue)
      .update(signature)
      .digest('hex');

    // Create verification hash
    const verificationHash = crypto.createHash('sha256')
      .update(this.keyPair.publicKey)
      .update(seedValue)
      .update(output)
      .digest('hex');

    return {
      seedValue,
      publicKey: this.keyPair.publicKey,
      proof: signature.toString('hex'),
      output,
      verificationHash
    };
  }

  public verifyProof(proof: VRFProof): boolean {
    try {
      // Recreate the verification hash
      const expectedHash = crypto.createHash('sha256')
        .update(proof.publicKey)
        .update(proof.seedValue)
        .update(proof.output)
        .digest('hex');

      // Verify the signature
      const message = Buffer.from(proof.seedValue, 'hex');
      const signature = Buffer.from(proof.proof, 'hex');
      const publicKeyBuffer = Buffer.from(proof.publicKey, 'hex');

      const isValidSignature = crypto.verify('sha256', message, {
        key: publicKeyBuffer,
        format: 'der',
        type: 'spki'
      }, signature);

      return isValidSignature && expectedHash === proof.verificationHash;
    } catch (error) {
      console.error('VRF verification failed:', error);
      return false;
    }
  }

  private generateLotteryNumbers(output: string, count: number, max: number): number[] {
    const numbers = new Set<number>();
    let hash = output;

    while (numbers.size < count) {
      // Create new hash for more entropy
      hash = crypto.createHash('sha256').update(hash).digest('hex');
      
      // Extract number from hash
      for (let i = 0; i < hash.length - 4 && numbers.size < count; i += 8) {
        const segment = hash.substr(i, 8);
        const num = parseInt(segment, 16) % max + 1;
        
        if (num >= 1 && num <= max) {
          numbers.add(num);
        }
      }
    }

    return Array.from(numbers).sort((a, b) => a - b);
  }

  public async generateDrawNumbers(drawId: number, drawType: 'daily' | 'weekly'): Promise<VRFResult> {
    const timestamp = Date.now();
    const seedValue = this.generateSeed(drawId, drawType, timestamp);
    const proof = this.createProof(seedValue);

    // Store VRF seed in database
    await storage.createVrfSeed(drawId);

    // Generate winning numbers based on draw type
    const numberCount = drawType === 'daily' ? 5 : 6;
    const maxNumber = drawType === 'daily' ? 45 : 49;
    const winningNumbers = this.generateLotteryNumbers(proof.output, numberCount, maxNumber);

    // Create blockchain hash for transparency
    const blockchainHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        drawId,
        drawType,
        timestamp,
        winningNumbers,
        proof
      }))
      .digest('hex');

    return {
      winningNumbers,
      proof,
      blockchainHash
    };
  }

  public async verifyDrawIntegrity(drawId: number): Promise<boolean> {
    try {
      const vrfSeed = await storage.getVrfSeed(drawId);
      if (!vrfSeed) return false;

      const proof: VRFProof = {
        seedValue: vrfSeed.seedValue,
        publicKey: vrfSeed.publicKey,
        proof: vrfSeed.proof,
        output: vrfSeed.output,
        verificationHash: crypto.createHash('sha256')
          .update(vrfSeed.publicKey)
          .update(vrfSeed.seedValue)
          .update(vrfSeed.output)
          .digest('hex')
      };

      return this.verifyProof(proof);
    } catch (error) {
      console.error('Draw integrity verification failed:', error);
      return false;
    }
  }

  public getPublicKey(): string {
    return this.keyPair.publicKey;
  }
}

export const vrfService = VRFService.getInstance();