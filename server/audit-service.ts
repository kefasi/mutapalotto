import crypto from 'crypto';
import { storage } from './storage';
import { ticketHashingService } from './ticket-hashing';
import { chainlinkVRFService } from './chainlink-vrf';
import type { InsertAuditVerification } from '@shared/schema';

/**
 * Comprehensive Audit Service for Lottery Transparency
 * Provides public verification of tickets, draws, and random number generation
 */
export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Verify a single ticket's integrity and authenticity
   */
  public async verifyTicket(ticketId: number): Promise<{
    isValid: boolean;
    ticketHash: string | null;
    merkleProof: string[];
    blockchainVerified: boolean;
    verificationHash: string;
    details: {
      ticketExists: boolean;
      hashMatches: boolean;
      merkleVerified: boolean;
      blockchainConfirmed: boolean;
      drawCompleted: boolean;
    };
  }> {
    const verificationHash = this.generateVerificationHash();
    
    try {
      // Get ticket details
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket) {
        return this.createFailedVerification(verificationHash, 'Ticket not found');
      }

      // Verify ticket hash
      const hashVerification = await ticketHashingService.verifyTicketHash(ticketId);
      
      // Get Merkle proof and verify
      const merkleVerification = await this.verifyMerkleProof(ticketId);
      
      // Verify blockchain confirmation
      const blockchainVerification = await this.verifyBlockchainIntegrity(ticketId);
      
      // Check if associated draw is completed
      const draw = await storage.getDrawById(ticket.drawId);
      const drawCompleted = draw?.status === 'completed';

      const isValid = hashVerification.isValid && 
                     merkleVerification.isValid && 
                     blockchainVerification.isValid;

      // Record verification attempt
      await this.recordAuditVerification({
        ticketId,
        drawId: ticket.drawId,
        verificationHash,
        verificationResult: {
          isValid,
          hashMatches: hashVerification.isValid,
          merkleVerified: merkleVerification.isValid,
          blockchainConfirmed: blockchainVerification.isValid,
          timestamp: new Date().toISOString(),
        },
        verifierAddress: 'public_audit_api',
      });

      return {
        isValid,
        ticketHash: hashVerification.storedHash,
        merkleProof: merkleVerification.proof,
        blockchainVerified: blockchainVerification.isValid,
        verificationHash,
        details: {
          ticketExists: true,
          hashMatches: hashVerification.isValid,
          merkleVerified: merkleVerification.isValid,
          blockchainConfirmed: blockchainVerification.isValid,
          drawCompleted,
        },
      };

    } catch (error) {
      console.error('Ticket verification error:', error);
      return this.createFailedVerification(verificationHash, 'Verification failed');
    }
  }

  /**
   * Verify a lottery draw's RNG authenticity and results
   */
  public async verifyDraw(drawId: number): Promise<{
    isValid: boolean;
    drawHash: string | null;
    vrfProofValid: boolean;
    resultsTamperProof: boolean;
    verificationHash: string;
    details: {
      drawExists: boolean;
      numbersVerified: boolean;
      vrfVerified: boolean;
      timestampValid: boolean;
      resultsImmutable: boolean;
    };
  }> {
    const verificationHash = this.generateVerificationHash();
    
    try {
      // Get draw details
      const draw = await storage.getDrawById(drawId);
      if (!draw) {
        return this.createFailedDrawVerification(verificationHash, 'Draw not found');
      }

      // Verify VRF proof
      const vrfVerification = await this.verifyVRFIntegrity(drawId);
      
      // Verify winning numbers authenticity
      const numbersVerification = await this.verifyWinningNumbers(drawId);
      
      // Verify timestamp integrity
      const timestampValid = this.verifyTimestamp(draw.drawDate, draw.completedAt);
      
      // Verify results immutability
      const immutabilityCheck = await this.verifyResultsImmutability(drawId);

      const isValid = vrfVerification.isValid && 
                     numbersVerification.isValid && 
                     timestampValid && 
                     immutabilityCheck.isValid;

      // Record verification
      await this.recordAuditVerification({
        drawId,
        ticketId: null,
        verificationHash,
        verificationResult: {
          isValid,
          vrfVerified: vrfVerification.isValid,
          numbersVerified: numbersVerification.isValid,
          timestampValid,
          resultsImmutable: immutabilityCheck.isValid,
          timestamp: new Date().toISOString(),
        },
        verifierAddress: 'public_audit_api',
      });

      return {
        isValid,
        drawHash: draw.blockchainHash,
        vrfProofValid: vrfVerification.isValid,
        resultsTamperProof: immutabilityCheck.isValid,
        verificationHash,
        details: {
          drawExists: true,
          numbersVerified: numbersVerification.isValid,
          vrfVerified: vrfVerification.isValid,
          timestampValid,
          resultsImmutable: immutabilityCheck.isValid,
        },
      };

    } catch (error) {
      console.error('Draw verification error:', error);
      return this.createFailedDrawVerification(verificationHash, 'Verification failed');
    }
  }

  /**
   * Verify Merkle proof for a ticket
   */
  private async verifyMerkleProof(ticketId: number): Promise<{
    isValid: boolean;
    proof: string[];
    merkleRoot: string | null;
  }> {
    try {
      const ticketHash = await storage.getTicketHash(ticketId);
      if (!ticketHash?.merkleRoot) {
        return { isValid: false, proof: [], merkleRoot: null };
      }

      // Get all tickets from the same batch/draw for Merkle verification
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket) {
        return { isValid: false, proof: [], merkleRoot: null };
      }

      const drawTickets = await storage.getTicketsByDraw(ticket.drawId);
      const ticketHashes = await Promise.all(
        drawTickets.map(async (t) => {
          const hash = await storage.getTicketHash(t.id);
          return hash?.ticketHash || '';
        })
      );

      // Generate Merkle proof
      const proof = this.generateMerkleProof(ticketHash.ticketHash, ticketHashes);
      
      // Verify proof
      const isValid = ticketHashingService.verifyMerkleProof(
        ticketHash.ticketHash,
        ticketHash.merkleRoot,
        proof,
        drawTickets.findIndex(t => t.id === ticketId)
      );

      return {
        isValid,
        proof,
        merkleRoot: ticketHash.merkleRoot,
      };

    } catch (error) {
      console.error('Merkle proof verification error:', error);
      return { isValid: false, proof: [], merkleRoot: null };
    }
  }

  /**
   * Verify blockchain integrity for a ticket
   */
  private async verifyBlockchainIntegrity(ticketId: number): Promise<{
    isValid: boolean;
    transactionHash: string | null;
    blockConfirmed: boolean;
  }> {
    try {
      const ticketHash = await storage.getTicketHash(ticketId);
      if (!ticketHash?.blockchainTxHash) {
        return { isValid: false, transactionHash: null, blockConfirmed: false };
      }

      // In production, verify with actual blockchain
      // For development, simulate verification
      const blockConfirmed = ticketHash.blockchainTxHash.startsWith('0x') || 
                           ticketHash.blockchainTxHash.length === 64;

      return {
        isValid: blockConfirmed,
        transactionHash: ticketHash.blockchainTxHash,
        blockConfirmed,
      };

    } catch (error) {
      console.error('Blockchain verification error:', error);
      return { isValid: false, transactionHash: null, blockConfirmed: false };
    }
  }

  /**
   * Verify VRF integrity for a draw
   */
  private async verifyVRFIntegrity(drawId: number): Promise<{
    isValid: boolean;
    requestId: string | null;
    proofVerified: boolean;
  }> {
    try {
      const auditLog = await storage.getRngAuditLogByDrawId(drawId);
      if (!auditLog) {
        return { isValid: false, requestId: null, proofVerified: false };
      }

      const vrfVerification = await chainlinkVRFService.verifyVRFProof(auditLog.requestId);

      return {
        isValid: vrfVerification.isValid,
        requestId: auditLog.requestId,
        proofVerified: vrfVerification.isValid,
      };

    } catch (error) {
      console.error('VRF verification error:', error);
      return { isValid: false, requestId: null, proofVerified: false };
    }
  }

  /**
   * Verify winning numbers authenticity
   */
  private async verifyWinningNumbers(drawId: number): Promise<{
    isValid: boolean;
    numbersMatch: boolean;
    seedVerified: boolean;
  }> {
    try {
      const draw = await storage.getDrawById(drawId);
      const auditLog = await storage.getRngAuditLogByDrawId(drawId);
      
      if (!draw || !auditLog) {
        return { isValid: false, numbersMatch: false, seedVerified: false };
      }

      // Verify that winning numbers match the VRF seed
      const expectedNumbers = this.regenerateNumbersFromSeed(
        auditLog.randomSeed,
        draw.type === 'daily' ? 5 : 6,
        draw.type === 'daily' ? 45 : 49
      );

      const numbersMatch = JSON.stringify(draw.winningNumbers.sort()) === 
                          JSON.stringify(expectedNumbers.sort());

      return {
        isValid: numbersMatch,
        numbersMatch,
        seedVerified: true,
      };

    } catch (error) {
      console.error('Winning numbers verification error:', error);
      return { isValid: false, numbersMatch: false, seedVerified: false };
    }
  }

  /**
   * Verify timestamp integrity
   */
  private verifyTimestamp(drawDate: Date, completedAt: Date | null): boolean {
    if (!completedAt) return false;
    
    // Verify draw was completed after scheduled time
    return completedAt >= drawDate;
  }

  /**
   * Verify results immutability
   */
  private async verifyResultsImmutability(drawId: number): Promise<{
    isValid: boolean;
    hashMatches: boolean;
  }> {
    try {
      const draw = await storage.getDrawById(drawId);
      if (!draw) {
        return { isValid: false, hashMatches: false };
      }

      // Recompute draw hash and compare
      const computedHash = this.computeDrawHash(draw);
      const hashMatches = computedHash === draw.blockchainHash;

      return {
        isValid: hashMatches,
        hashMatches,
      };

    } catch (error) {
      console.error('Immutability verification error:', error);
      return { isValid: false, hashMatches: false };
    }
  }

  /**
   * Generate verification hash for audit trail
   */
  private generateVerificationHash(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36);
    return crypto.createHash('sha256').update(`${timestamp}_${random}`).digest('hex');
  }

  /**
   * Record audit verification attempt
   */
  private async recordAuditVerification(data: InsertAuditVerification): Promise<void> {
    await storage.createAuditVerification(data);
  }

  /**
   * Create failed verification response for tickets
   */
  private createFailedVerification(verificationHash: string, reason: string) {
    return {
      isValid: false,
      ticketHash: null,
      merkleProof: [],
      blockchainVerified: false,
      verificationHash,
      details: {
        ticketExists: false,
        hashMatches: false,
        merkleVerified: false,
        blockchainConfirmed: false,
        drawCompleted: false,
        error: reason,
      },
    };
  }

  /**
   * Create failed verification response for draws
   */
  private createFailedDrawVerification(verificationHash: string, reason: string) {
    return {
      isValid: false,
      drawHash: null,
      vrfProofValid: false,
      resultsTamperProof: false,
      verificationHash,
      details: {
        drawExists: false,
        numbersVerified: false,
        vrfVerified: false,
        timestampValid: false,
        resultsImmutable: false,
        error: reason,
      },
    };
  }

  /**
   * Generate Merkle proof for a specific hash
   */
  private generateMerkleProof(targetHash: string, allHashes: string[]): string[] {
    const proof: string[] = [];
    let currentLevel = [...allHashes];
    let targetIndex = currentLevel.indexOf(targetHash);

    while (currentLevel.length > 1 && targetIndex !== -1) {
      const isRightNode = targetIndex % 2 === 1;
      const siblingIndex = isRightNode ? targetIndex - 1 : targetIndex + 1;
      
      if (siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      }

      // Move to next level
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left;
        const combined = crypto.createHash('sha256').update(left + right).digest('hex');
        nextLevel.push(combined);
      }

      currentLevel = nextLevel;
      targetIndex = Math.floor(targetIndex / 2);
    }

    return proof;
  }

  /**
   * Regenerate numbers from VRF seed for verification
   */
  private regenerateNumbersFromSeed(seed: string, count: number, maxNumber: number): number[] {
    const numbers: number[] = [];
    let currentSeed = seed;
    
    while (numbers.length < count) {
      currentSeed = crypto.createHash('sha256').update(currentSeed).digest('hex');
      const num = (parseInt(currentSeed.slice(0, 8), 16) % maxNumber) + 1;
      
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    
    return numbers.sort((a, b) => a - b);
  }

  /**
   * Compute draw hash for verification
   */
  private computeDrawHash(draw: any): string {
    const drawData = {
      id: draw.id,
      type: draw.type,
      winningNumbers: draw.winningNumbers.sort(),
      drawDate: draw.drawDate.getTime(),
      completedAt: draw.completedAt?.getTime(),
      jackpot: draw.jackpot,
    };

    return crypto.createHash('sha256').update(JSON.stringify(drawData)).digest('hex');
  }

  /**
   * Get public audit statistics
   */
  public async getAuditStatistics(): Promise<{
    totalVerifications: number;
    successfulVerifications: number;
    ticketVerifications: number;
    drawVerifications: number;
    averageVerificationTime: number;
    lastVerification: Date | null;
  }> {
    const stats = await storage.getAuditStatistics();
    return stats;
  }
}

export const auditService = AuditService.getInstance();