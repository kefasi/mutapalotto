import crypto from 'crypto';
import { storage } from './storage';
import { vrfService } from './vrf';

interface BlockchainTransaction {
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

interface BlockchainBlock {
  index: number;
  timestamp: number;
  transactions: BlockchainTransaction[];
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

export class BlockchainService {
  private static instance: BlockchainService;
  private blockchain: BlockchainBlock[] = [];
  private pendingTransactions: BlockchainTransaction[] = [];
  private difficulty = 4; // Number of leading zeros required in hash

  private constructor() {
    this.createGenesisBlock();
  }

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  private createGenesisBlock(): void {
    const genesisBlock: BlockchainBlock = {
      index: 0,
      timestamp: Date.now(),
      transactions: [],
      previousHash: '0',
      merkleRoot: this.calculateMerkleRoot([]),
      hash: '',
      nonce: 0,
      difficulty: this.difficulty
    };

    genesisBlock.hash = this.calculateBlockHash(genesisBlock);
    this.blockchain.push(genesisBlock);
  }

  private calculateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateBlockHash(block: BlockchainBlock): string {
    const blockData = JSON.stringify({
      index: block.index,
      timestamp: block.timestamp,
      transactions: block.transactions,
      previousHash: block.previousHash,
      merkleRoot: block.merkleRoot,
      nonce: block.nonce
    });
    return this.calculateHash(blockData);
  }

  private calculateMerkleRoot(transactions: BlockchainTransaction[]): string {
    if (transactions.length === 0) {
      return this.calculateHash('');
    }

    if (transactions.length === 1) {
      return this.calculateHash(JSON.stringify(transactions[0]));
    }

    let level = transactions.map(tx => this.calculateHash(JSON.stringify(tx)));

    while (level.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left;
        nextLevel.push(this.calculateHash(left + right));
      }
      
      level = nextLevel;
    }

    return level[0];
  }

  private mineBlock(block: BlockchainBlock): void {
    const target = '0'.repeat(this.difficulty);
    
    while (block.hash.substring(0, this.difficulty) !== target) {
      block.nonce++;
      block.hash = this.calculateBlockHash(block);
    }

    console.log(`Block mined: ${block.hash}`);
  }

  public async recordDrawResult(
    drawId: number, 
    drawType: 'daily' | 'weekly', 
    winningNumbers: number[]
  ): Promise<string> {
    try {
      // Get VRF proof for this draw
      const vrfResult = await vrfService.generateDrawNumbers(drawId, drawType);
      
      // Get participant information
      const tickets = await storage.getTicketsByDraw(drawId);
      const participantCount = tickets.length;
      const totalStake = tickets.reduce((sum, ticket) => sum + parseFloat(ticket.cost), 0).toString();

      // Create blockchain transaction
      const transaction: BlockchainTransaction = {
        id: this.generateTransactionId(drawId, drawType),
        drawId,
        drawType,
        winningNumbers,
        vrfProof: JSON.stringify(vrfResult.proof),
        timestamp: Date.now(),
        previousHash: this.getLatestBlock().hash,
        hash: '',
        merkleRoot: '',
        participantCount,
        totalStake
      };

      // Calculate transaction hash
      const transactionData = JSON.stringify({
        id: transaction.id,
        drawId: transaction.drawId,
        drawType: transaction.drawType,
        winningNumbers: transaction.winningNumbers,
        vrfProof: transaction.vrfProof,
        timestamp: transaction.timestamp,
        previousHash: transaction.previousHash,
        participantCount: transaction.participantCount,
        totalStake: transaction.totalStake
      });
      transaction.hash = this.calculateHash(transactionData);

      // Add to pending transactions
      this.pendingTransactions.push(transaction);

      // Create new block with pending transactions
      const newBlock = this.createNewBlock();
      
      return newBlock.hash;
    } catch (error) {
      console.error('Blockchain recording error:', error);
      throw new Error('Failed to record draw result on blockchain');
    }
  }

  private generateTransactionId(drawId: number, drawType: string): string {
    const timestamp = Date.now();
    const data = `${drawId}-${drawType}-${timestamp}`;
    return this.calculateHash(data);
  }

  private getLatestBlock(): BlockchainBlock {
    return this.blockchain[this.blockchain.length - 1];
  }

  private createNewBlock(): BlockchainBlock {
    const previousBlock = this.getLatestBlock();
    
    const newBlock: BlockchainBlock = {
      index: previousBlock.index + 1,
      timestamp: Date.now(),
      transactions: [...this.pendingTransactions],
      previousHash: previousBlock.hash,
      merkleRoot: this.calculateMerkleRoot(this.pendingTransactions),
      hash: '',
      nonce: 0,
      difficulty: this.difficulty
    };

    // Mine the block
    this.mineBlock(newBlock);
    
    // Add to blockchain
    this.blockchain.push(newBlock);
    
    // Clear pending transactions
    this.pendingTransactions = [];
    
    return newBlock;
  }

  public async verifyDrawIntegrity(drawId: number): Promise<VerificationResult> {
    try {
      // Find the transaction for this draw
      const transaction = this.findTransactionByDrawId(drawId);
      
      if (!transaction) {
        return {
          isValid: false,
          drawId,
          verificationHash: '',
          timestamp: new Date().toISOString(),
          details: {
            vrfVerified: false,
            merkleVerified: false,
            hashChainVerified: false,
            participantCountVerified: false
          }
        };
      }

      // Verify VRF proof
      const vrfProof = JSON.parse(transaction.vrfProof);
      const vrfVerified = vrfService.verifyProof(vrfProof);

      // Verify merkle root
      const block = this.findBlockContainingTransaction(transaction.id);
      const merkleVerified = block ? 
        block.merkleRoot === this.calculateMerkleRoot(block.transactions) : false;

      // Verify hash chain integrity
      const hashChainVerified = this.verifyBlockchain();

      // Verify participant count
      const tickets = await storage.getTicketsByDraw(drawId);
      const participantCountVerified = tickets.length === transaction.participantCount;

      const isValid = vrfVerified && merkleVerified && hashChainVerified && participantCountVerified;

      // Generate verification hash
      const verificationData = {
        drawId,
        transactionHash: transaction.hash,
        vrfVerified,
        merkleVerified,
        hashChainVerified,
        participantCountVerified,
        timestamp: new Date().toISOString()
      };
      const verificationHash = this.calculateHash(JSON.stringify(verificationData));

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
      return {
        isValid: false,
        drawId,
        verificationHash: '',
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

  private findTransactionByDrawId(drawId: number): BlockchainTransaction | null {
    for (const block of this.blockchain) {
      const transaction = block.transactions.find(tx => tx.drawId === drawId);
      if (transaction) {
        return transaction;
      }
    }
    return null;
  }

  private findBlockContainingTransaction(transactionId: string): BlockchainBlock | null {
    return this.blockchain.find(block => 
      block.transactions.some(tx => tx.id === transactionId)
    ) || null;
  }

  private verifyBlockchain(): boolean {
    for (let i = 1; i < this.blockchain.length; i++) {
      const currentBlock = this.blockchain[i];
      const previousBlock = this.blockchain[i - 1];

      // Verify current block hash
      if (currentBlock.hash !== this.calculateBlockHash(currentBlock)) {
        return false;
      }

      // Verify previous hash reference
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }

      // Verify merkle root
      if (currentBlock.merkleRoot !== this.calculateMerkleRoot(currentBlock.transactions)) {
        return false;
      }
    }

    return true;
  }

  public getBlockchainInfo(): {
    blockCount: number;
    latestBlockHash: string;
    totalTransactions: number;
    isValid: boolean;
  } {
    const totalTransactions = this.blockchain.reduce(
      (sum, block) => sum + block.transactions.length, 0
    );

    return {
      blockCount: this.blockchain.length,
      latestBlockHash: this.getLatestBlock().hash,
      totalTransactions,
      isValid: this.verifyBlockchain()
    };
  }

  public getDrawHistory(limit: number = 50): BlockchainTransaction[] {
    const allTransactions: BlockchainTransaction[] = [];
    
    for (const block of this.blockchain) {
      allTransactions.push(...block.transactions);
    }

    return allTransactions
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  public exportBlockchainData(): string {
    return JSON.stringify({
      blockchain: this.blockchain,
      info: this.getBlockchainInfo(),
      exportTimestamp: new Date().toISOString()
    }, null, 2);
  }
}

export const blockchainService = BlockchainService.getInstance();