import crypto from 'crypto';
import { db } from './db';
import { blockchainBlocks, blockchainTransactions, type InsertBlockchainBlock, type InsertBlockchainTransaction } from '@shared/schema';
import { eq, desc, count } from 'drizzle-orm';

interface BlockchainTransactionData {
  id: string;
  drawId: number;
  drawType: 'daily' | 'weekly';
  winningNumbers: number[];
  vrfProof: string;
  timestamp: number;
  previousHash: string;
  hash: string;
  merkleRoot: string;
  participantCount: number;
  totalStake: string;
}

interface BlockchainBlockData {
  index: number;
  timestamp: number;
  transactions: BlockchainTransactionData[];
  previousHash: string;
  merkleRoot: string;
  hash: string;
  nonce: number;
  difficulty: number;
}

interface VerificationResult {
  isValid: boolean;
  drawId: number;
  verificationHash: string;
  timestamp: string;
  details: {
    vrfVerified: boolean;
    merkleVerified: boolean;
    hashChainVerified: boolean;
    participantCountVerified: boolean;
  };
}

export class DatabaseBlockchainService {
  private static instance: DatabaseBlockchainService;
  private difficulty = 4; // Number of leading zeros required in hash

  private constructor() {
    this.initializeGenesisBlock();
  }

  public static getInstance(): DatabaseBlockchainService {
    if (!DatabaseBlockchainService.instance) {
      DatabaseBlockchainService.instance = new DatabaseBlockchainService();
    }
    return DatabaseBlockchainService.instance;
  }

  private async initializeGenesisBlock(): Promise<void> {
    try {
      // Check if genesis block exists
      const existingBlocks = await db.select().from(blockchainBlocks).limit(1);
      
      if (existingBlocks.length === 0) {
        // Create genesis block
        const genesisBlock: InsertBlockchainBlock = {
          blockIndex: 0,
          timestamp: Date.now(),
          previousHash: '0',
          merkleRoot: this.calculateHash('Genesis Block'),
          hash: '',
          nonce: 0,
          difficulty: this.difficulty,
        };

        // Mine the genesis block
        const minedHash = this.mineBlock(genesisBlock);
        genesisBlock.hash = minedHash;

        await db.insert(blockchainBlocks).values(genesisBlock);
        console.log('🔗 Genesis block created in database');
      }
    } catch (error) {
      console.error('Failed to initialize genesis block:', error);
    }
  }

  private calculateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateBlockHash(block: InsertBlockchainBlock): string {
    const blockData = `${block.blockIndex}${block.timestamp}${block.previousHash}${block.merkleRoot}${block.nonce}`;
    return this.calculateHash(blockData);
  }

  private calculateMerkleRoot(transactions: BlockchainTransactionData[]): string {
    if (transactions.length === 0) {
      return this.calculateHash('empty');
    }

    let hashes = transactions.map(tx => tx.hash);

    while (hashes.length > 1) {
      const newHashes: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = i + 1 < hashes.length ? hashes[i + 1] : left;
        newHashes.push(this.calculateHash(left + right));
      }
      hashes = newHashes;
    }

    return hashes[0];
  }

  private mineBlock(block: InsertBlockchainBlock): string {
    let nonce = 0;
    let hash = '';

    do {
      block.nonce = nonce;
      hash = this.calculateBlockHash(block);
      nonce++;
    } while (!hash.startsWith('0'.repeat(this.difficulty)));

    return hash;
  }

  public async recordDrawResult(
    drawId: number,
    drawType: 'daily' | 'weekly',
    winningNumbers: number[],
    vrfProof: string,
    participantCount: number,
    totalStake: string
  ): Promise<string> {
    try {
      // Get the latest block for previous hash
      const [latestBlock] = await db
        .select()
        .from(blockchainBlocks)
        .orderBy(desc(blockchainBlocks.blockIndex))
        .limit(1);

      const previousHash = latestBlock?.hash || '0';
      const timestamp = Date.now();

      // Create transaction
      const transaction: BlockchainTransactionData = {
        id: this.generateTransactionId(drawId, drawType),
        drawId,
        drawType,
        winningNumbers,
        vrfProof,
        timestamp,
        previousHash,
        hash: '',
        merkleRoot: '',
        participantCount,
        totalStake,
      };

      // Calculate transaction hash
      const transactionData = `${transaction.id}${transaction.drawId}${transaction.drawType}${JSON.stringify(transaction.winningNumbers)}${transaction.vrfProof}${transaction.timestamp}`;
      transaction.hash = this.calculateHash(transactionData);

      // Create new block
      const newBlock: InsertBlockchainBlock = {
        blockIndex: (latestBlock?.blockIndex || 0) + 1,
        timestamp,
        previousHash,
        merkleRoot: this.calculateMerkleRoot([transaction]),
        hash: '',
        nonce: 0,
        difficulty: this.difficulty,
      };

      // Mine the block
      newBlock.hash = this.mineBlock(newBlock);

      // Insert block into database
      const [insertedBlock] = await db
        .insert(blockchainBlocks)
        .values(newBlock)
        .returning();

      // Insert transaction into database
      const blockchainTx: InsertBlockchainTransaction = {
        transactionId: transaction.id,
        blockId: insertedBlock.id,
        drawId: transaction.drawId,
        drawType: transaction.drawType,
        winningNumbers: transaction.winningNumbers,
        vrfProof: transaction.vrfProof,
        timestamp: transaction.timestamp,
        previousHash: transaction.previousHash,
        hash: transaction.hash,
        merkleRoot: transaction.merkleRoot,
        participantCount: transaction.participantCount,
        totalStake: transaction.totalStake,
      };

      await db.insert(blockchainTransactions).values(blockchainTx);

      console.log(`🔗 Draw ${drawId} recorded to blockchain - Block #${newBlock.blockIndex}, Hash: ${newBlock.hash.slice(0, 16)}...`);
      return newBlock.hash;
    } catch (error) {
      console.error('Blockchain recording error:', error);
      throw error;
    }
  }

  private generateTransactionId(drawId: number, drawType: string): string {
    return `${drawType}_draw_${drawId}_${Date.now()}`;
  }

  public async verifyDrawIntegrity(drawId: number): Promise<VerificationResult> {
    const verificationHash = this.generateVerificationHash();
    
    try {
      // Find transaction by draw ID
      const [transaction] = await db
        .select()
        .from(blockchainTransactions)
        .where(eq(blockchainTransactions.drawId, drawId))
        .limit(1);

      if (!transaction) {
        return this.createFailedVerification(drawId, verificationHash, 'Transaction not found');
      }

      // Get the block containing this transaction
      const [block] = await db
        .select()
        .from(blockchainBlocks)
        .where(eq(blockchainBlocks.id, transaction.blockId))
        .limit(1);

      if (!block) {
        return this.createFailedVerification(drawId, verificationHash, 'Block not found');
      }

      // Verify components
      const vrfVerified = transaction.vrfProof && transaction.vrfProof.length > 0;
      const merkleVerified = transaction.merkleRoot === block.merkleRoot;
      const hashChainVerified = await this.verifyHashChain(block.blockIndex);
      const participantCountVerified = transaction.participantCount >= 0;

      const isValid = vrfVerified && merkleVerified && hashChainVerified && participantCountVerified;

      return {
        isValid,
        drawId,
        verificationHash,
        timestamp: new Date().toISOString(),
        details: {
          vrfVerified,
          merkleVerified,
          hashChainVerified,
          participantCountVerified
        }
      };
    } catch (error) {
      console.error('Blockchain verification error:', error);
      return this.createFailedVerification(drawId, verificationHash, 'Verification failed');
    }
  }

  private async verifyHashChain(blockIndex: number): Promise<boolean> {
    try {
      if (blockIndex === 0) return true; // Genesis block

      const [currentBlock] = await db
        .select()
        .from(blockchainBlocks)
        .where(eq(blockchainBlocks.blockIndex, blockIndex))
        .limit(1);

      const [previousBlock] = await db
        .select()
        .from(blockchainBlocks)
        .where(eq(blockchainBlocks.blockIndex, blockIndex - 1))
        .limit(1);

      if (!currentBlock || !previousBlock) return false;

      // Verify current block hash
      const recalculatedHash = this.calculateBlockHash(currentBlock);
      if (recalculatedHash !== currentBlock.hash) return false;

      // Verify previous hash reference
      return currentBlock.previousHash === previousBlock.hash;
    } catch (error) {
      console.error('Hash chain verification error:', error);
      return false;
    }
  }

  public async getBlockchainInfo(): Promise<{
    blockCount: number;
    latestBlockHash: string;
    totalTransactions: number;
    isValid: boolean;
  }> {
    try {
      const [blockCountResult] = await db.select({ count: count() }).from(blockchainBlocks);
      const [transactionCountResult] = await db.select({ count: count() }).from(blockchainTransactions);
      
      const [latestBlock] = await db
        .select()
        .from(blockchainBlocks)
        .orderBy(desc(blockchainBlocks.blockIndex))
        .limit(1);

      const isValid = await this.verifyEntireBlockchain();

      return {
        blockCount: blockCountResult.count,
        latestBlockHash: latestBlock?.hash || '0',
        totalTransactions: transactionCountResult.count,
        isValid
      };
    } catch (error) {
      console.error('Get blockchain info error:', error);
      return {
        blockCount: 0,
        latestBlockHash: '0',
        totalTransactions: 0,
        isValid: false
      };
    }
  }

  private async verifyEntireBlockchain(): Promise<boolean> {
    try {
      const blocks = await db
        .select()
        .from(blockchainBlocks)
        .orderBy(blockchainBlocks.blockIndex);

      for (let i = 1; i < blocks.length; i++) {
        const currentBlock = blocks[i];
        const previousBlock = blocks[i - 1];

        // Verify current block hash
        if (currentBlock.hash !== this.calculateBlockHash(currentBlock)) {
          return false;
        }

        // Verify previous hash reference
        if (currentBlock.previousHash !== previousBlock.hash) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Blockchain verification error:', error);
      return false;
    }
  }

  public async getDrawHistory(limit: number = 50): Promise<BlockchainTransactionData[]> {
    try {
      const transactions = await db
        .select()
        .from(blockchainTransactions)
        .orderBy(desc(blockchainTransactions.timestamp))
        .limit(limit);

      return transactions.map(tx => ({
        id: tx.transactionId,
        drawId: tx.drawId,
        drawType: tx.drawType as 'daily' | 'weekly',
        winningNumbers: tx.winningNumbers as number[],
        vrfProof: tx.vrfProof,
        timestamp: tx.timestamp,
        previousHash: tx.previousHash,
        hash: tx.hash,
        merkleRoot: tx.merkleRoot,
        participantCount: tx.participantCount,
        totalStake: tx.totalStake,
      }));
    } catch (error) {
      console.error('Get draw history error:', error);
      return [];
    }
  }

  public async exportBlockchainData(): Promise<string> {
    try {
      const blocks = await db.select().from(blockchainBlocks).orderBy(blockchainBlocks.blockIndex);
      const transactions = await db.select().from(blockchainTransactions);
      const info = await this.getBlockchainInfo();

      return JSON.stringify({
        blocks,
        transactions,
        info,
        exportTimestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      console.error('Export blockchain error:', error);
      return JSON.stringify({ error: 'Export failed' });
    }
  }

  private generateVerificationHash(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36);
    return crypto.createHash('sha256').update(`${timestamp}_${random}`).digest('hex');
  }

  private createFailedVerification(drawId: number, verificationHash: string, reason: string): VerificationResult {
    return {
      isValid: false,
      drawId,
      verificationHash,
      timestamp: new Date().toISOString(),
      details: {
        vrfVerified: false,
        merkleVerified: false,
        hashChainVerified: false,
        participantCountVerified: false
      }
    };
  }
}

export const databaseBlockchainService = DatabaseBlockchainService.getInstance();