import crypto from 'crypto';
import { storage } from './storage';
import type { Ticket, InsertTicketHash } from '@shared/schema';

/**
 * Cryptographic Ticket Hashing Service
 * Generates secure hashes of ticket data for blockchain verification
 */
export class TicketHashingService {
  private static instance: TicketHashingService;

  private constructor() {}

  public static getInstance(): TicketHashingService {
    if (!TicketHashingService.instance) {
      TicketHashingService.instance = new TicketHashingService();
    }
    return TicketHashingService.instance;
  }

  /**
   * Generate cryptographic hash for a ticket at purchase time
   */
  public async generateTicketHash(ticket: Ticket): Promise<string> {
    // Create deterministic ticket data structure
    const ticketData = {
      ticketId: ticket.id,
      userId: ticket.userId,
      drawId: ticket.drawId,
      selectedNumbers: ticket.selectedNumbers.sort((a, b) => a - b), // Ensure consistent ordering
      cost: ticket.cost,
      purchaseTimestamp: ticket.createdAt.getTime(),
      agentId: ticket.agentId || null,
    };

    // Generate SHA-256 hash of ticket data
    const ticketHash = this.hashData(JSON.stringify(ticketData));

    // Store hash in database and blockchain
    await this.storeTicketHash({
      ticketId: ticket.id,
      ticketHash,
      hashAlgorithm: 'SHA-256',
    });

    return ticketHash;
  }

  /**
   * Generate Merkle tree root for a batch of tickets
   */
  public generateMerkleRoot(ticketHashes: string[]): string {
    if (ticketHashes.length === 0) return '';
    if (ticketHashes.length === 1) return ticketHashes[0];

    // Build Merkle tree
    let currentLevel = [...ticketHashes];
    
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || left; // Handle odd number of elements
        const combined = this.hashData(left + right);
        nextLevel.push(combined);
      }
      
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Verify ticket hash integrity
   */
  public async verifyTicketHash(ticketId: number): Promise<{
    isValid: boolean;
    storedHash: string | null;
    computedHash: string | null;
    ticket: Ticket | null;
  }> {
    try {
      // Get ticket and stored hash
      const ticket = await storage.getTicketById(ticketId);
      if (!ticket) {
        return { isValid: false, storedHash: null, computedHash: null, ticket: null };
      }

      const storedHashRecord = await storage.getTicketHash(ticketId);
      if (!storedHashRecord) {
        return { isValid: false, storedHash: null, computedHash: null, ticket };
      }

      // Recompute hash
      const computedHash = await this.generateTicketHash(ticket);

      return {
        isValid: storedHashRecord.ticketHash === computedHash,
        storedHash: storedHashRecord.ticketHash,
        computedHash,
        ticket,
      };
    } catch (error) {
      console.error('Ticket hash verification error:', error);
      return { isValid: false, storedHash: null, computedHash: null, ticket: null };
    }
  }

  /**
   * Generate blockchain transaction hash for storing ticket hashes
   */
  public async submitToBlockchain(ticketHashes: string[], merkleRoot: string): Promise<string> {
    // Simulate blockchain transaction
    // In production, this would submit to actual blockchain (Polygon, Ethereum, etc.)
    const transactionData = {
      merkleRoot,
      ticketHashes: ticketHashes.slice(0, 10), // Include first 10 hashes as proof
      timestamp: Date.now(),
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
    };

    const txHash = this.hashData(JSON.stringify(transactionData));
    
    // Update ticket hash records with blockchain transaction hash
    for (const hash of ticketHashes) {
      await storage.updateTicketHashBlockchain(hash, txHash);
    }

    return txHash;
  }

  /**
   * Store ticket hash in database
   */
  private async storeTicketHash(hashData: InsertTicketHash): Promise<void> {
    await storage.createTicketHash(hashData);
  }

  /**
   * Generate SHA-256 hash of data
   */
  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate batch hash for multiple tickets (for Merkle tree)
   */
  public async processBatch(tickets: Ticket[]): Promise<{
    ticketHashes: string[];
    merkleRoot: string;
    blockchainTxHash: string;
  }> {
    // Generate individual ticket hashes
    const ticketHashes: string[] = [];
    for (const ticket of tickets) {
      const hash = await this.generateTicketHash(ticket);
      ticketHashes.push(hash);
    }

    // Generate Merkle root
    const merkleRoot = this.generateMerkleRoot(ticketHashes);

    // Submit to blockchain
    const blockchainTxHash = await this.submitToBlockchain(ticketHashes, merkleRoot);

    // Update Merkle root for all tickets in batch
    for (const hash of ticketHashes) {
      await storage.updateTicketHashMerkle(hash, merkleRoot);
    }

    return {
      ticketHashes,
      merkleRoot,
      blockchainTxHash,
    };
  }

  /**
   * Verify Merkle proof for a ticket
   */
  public verifyMerkleProof(
    ticketHash: string,
    merkleRoot: string,
    proof: string[],
    index: number
  ): boolean {
    let currentHash = ticketHash;
    
    for (let i = 0; i < proof.length; i++) {
      const proofElement = proof[i];
      const isRightNode = (index >> i) & 1;
      
      if (isRightNode) {
        currentHash = this.hashData(proofElement + currentHash);
      } else {
        currentHash = this.hashData(currentHash + proofElement);
      }
    }
    
    return currentHash === merkleRoot;
  }

  /**
   * Build Merkle tree visualization for audit purposes
   */
  public buildMerkleTreeVisualization(hashes: string[]): {
    root: string;
    levels: Array<{ level: number; hashes: string[]; description: string }>;
  } {
    if (hashes.length === 0) {
      return {
        root: this.hashData(''),
        levels: [{ level: 0, hashes: [], description: 'No tickets' }]
      };
    }

    const levels: Array<{ level: number; hashes: string[]; description: string }> = [];
    let currentLevel = [...hashes];
    let levelNumber = 0;

    // Add leaf level (individual ticket hashes)
    levels.push({
      level: levelNumber,
      hashes: [...currentLevel],
      description: `Level ${levelNumber}: Individual ticket hashes (${currentLevel.length} tickets)`
    });

    // Build tree levels by pairing and hashing
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = this.hashData(left + right);
        nextLevel.push(combined);
      }
      
      levelNumber++;
      currentLevel = nextLevel;
      
      levels.push({
        level: levelNumber,
        hashes: [...currentLevel],
        description: `Level ${levelNumber}: Combined hashes (${currentLevel.length} nodes)`
      });
    }

    return {
      root: currentLevel[0],
      levels
    };
  }

  /**
   * Generate Merkle proof for a specific ticket
   */
  public generateMerkleProof(ticketHashes: string[], targetIndex: number): string[] {
    if (targetIndex >= ticketHashes.length) {
      throw new Error('Target index out of bounds');
    }

    const proof: string[] = [];
    let currentLevel = [...ticketHashes];
    let currentIndex = targetIndex;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        
        // If current index is part of this pair, add the sibling to proof
        if (i === currentIndex || i + 1 === currentIndex) {
          const sibling = i === currentIndex ? right : left;
          if (sibling !== currentLevel[currentIndex]) {
            proof.push(sibling);
          }
        }
        
        nextLevel.push(this.hashData(left + right));
      }
      
      currentIndex = Math.floor(currentIndex / 2);
      currentLevel = nextLevel;
    }

    return proof;
  }
}

export const ticketHashingService = TicketHashingService.getInstance();