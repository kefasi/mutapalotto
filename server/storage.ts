import { 
  users, lotteryDraws, tickets, transactions, agentSales, agentCommissions, agentPayments, agentTargets, kycDocuments, sessions,
  communityStories, faqs, supportTickets, ticketResponses, backupLogs, disasterRecoveryTests, userNotifications,
  type User, type InsertUser,
  type LotteryDraw, type InsertLotteryDraw,
  type Ticket, type InsertTicket,
  type Transaction, type InsertTransaction,
  type AgentSale, type InsertAgentSale,
  type AgentCommission, type InsertAgentCommission,
  type AgentPayment, type InsertAgentPayment,
  type AgentTarget, type InsertAgentTarget,
  type KycDocument, type InsertKycDocument,
  type VrfSeed, type InsertVrfSeed,
  type Session, type InsertSession,
  type CommunityStory, type InsertCommunityStory,
  type Faq, type InsertFaq,
  type SupportTicket, type InsertSupportTicket,
  type TicketResponse, type InsertTicketResponse,
  type BackupLog, type InsertBackupLog,
  type DisasterRecoveryTest, type InsertDisasterRecoveryTest,
  type UserNotification, type InsertUserNotification
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, amount: string): Promise<User>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;
  
  // Admin functions
  getAllUsers(): Promise<User[]>;
  getAllAgents(): Promise<User[]>;
  freezeUser(userId: number): Promise<User>;
  unfreezeUser(userId: number): Promise<User>;
  banUser(userId: number): Promise<User>;
  unbanUser(userId: number): Promise<User>;
  makeUserAdmin(userId: number): Promise<User>;
  
  // Lottery Draws
  getLatestDraw(type: 'daily' | 'weekly'): Promise<LotteryDraw | undefined>;
  getUpcomingDraw(type: 'daily' | 'weekly'): Promise<LotteryDraw | undefined>;
  createDraw(draw: InsertLotteryDraw): Promise<LotteryDraw>;
  completeDraw(drawId: number, winningNumbers: number[], blockchainHash: string): Promise<LotteryDraw>;
  getAllDraws(): Promise<LotteryDraw[]>;
  updateDrawJackpot(drawId: number, jackpotAmount: string): Promise<LotteryDraw>;
  getDraw(drawId: number): Promise<LotteryDraw | undefined>;
  updateDraw(drawId: number, updates: Partial<LotteryDraw>): Promise<LotteryDraw>;
  deleteDraw(drawId: number): Promise<void>;
  
  // Tickets
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicketsByUser(userId: number): Promise<Ticket[]>;
  getTicketsByDraw(drawId: number): Promise<Ticket[]>;
  getAllTickets(): Promise<Ticket[]>;
  updateTicketResults(ticketId: number, matchedNumbers: number, prizeAmount: string, isWinner: boolean): Promise<Ticket>;
  
  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByUser(userId: number): Promise<Transaction[]>;
  updateTransactionStatus(transactionId: number, status: string, failureReason?: string): Promise<Transaction>;
  
  // Agent Sales
  createAgentSale(sale: InsertAgentSale): Promise<AgentSale>;
  getAgentSales(agentId: number, startDate?: Date, endDate?: Date): Promise<AgentSale[]>;
  
  // Agent Commission Tracking
  calculateAgentCommission(agentId: number, periodStart: Date, periodEnd: Date): Promise<AgentCommission>;
  getAgentCommissions(agentId: number, limit?: number): Promise<AgentCommission[]>;
  markCommissionPaid(commissionId: number, paymentMethod: string, paymentReference: string): Promise<AgentCommission>;
  
  // Agent Payments
  createAgentPayment(payment: InsertAgentPayment): Promise<AgentPayment>;
  getAgentPayments(agentId: number): Promise<AgentPayment[]>;
  updatePaymentStatus(paymentId: number, status: 'completed' | 'failed', failureReason?: string): Promise<AgentPayment>;
  
  // Agent Targets
  createAgentTarget(target: InsertAgentTarget): Promise<AgentTarget>;
  getAgentTargets(agentId: number): Promise<AgentTarget[]>;
  checkTargetAchievement(agentId: number, targetId: number): Promise<AgentTarget>;
  
  // Agent Analytics
  getAgentPerformanceStats(agentId: number, startDate: Date, endDate: Date): Promise<any>;
  getTopPerformingAgents(period: 'weekly' | 'monthly', limit?: number): Promise<any[]>;
  
  // KYC Documents
  uploadKycDocument(document: InsertKycDocument): Promise<KycDocument>;
  getKycDocuments(userId: number): Promise<KycDocument[]>;
  updateKycStatus(documentId: number, status: 'approved' | 'rejected' | 'failed', apiResponse?: any, failureReason?: string): Promise<KycDocument>;
  verifyNationalId(userId: number, nationalId: string, firstName?: string, lastName?: string): Promise<KycDocument>;
  
  // VRF Seeds
  createVrfSeed(drawId: number): Promise<VrfSeed>;
  getVrfSeed(drawId: number): Promise<VrfSeed | undefined>;
  
  // Admin User Management
  getAllUsers(): Promise<User[]>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<User>;
  freezeUser(userId: number): Promise<User>;
  unfreezeUser(userId: number): Promise<User>;
  banUser(userId: number): Promise<User>;
  unbanUser(userId: number): Promise<User>;
  
  // Admin KYC Management
  getPendingKycDocuments(): Promise<KycDocument[]>;
  getKycDocument(documentId: number): Promise<KycDocument | undefined>;
  
  // Admin Draws
  getUpcomingDraws(): Promise<any>;
  
  // Sessions
  createSession(userId: number): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  deleteSession(sessionId: string): Promise<void>;

  // Community Stories (Admin managed)
  getCommunityStories(status?: string, featured?: boolean): Promise<CommunityStory[]>;
  getCommunityStory(id: number): Promise<CommunityStory | undefined>;
  createCommunityStory(story: InsertCommunityStory): Promise<CommunityStory>;
  updateCommunityStory(id: number, story: Partial<InsertCommunityStory>): Promise<CommunityStory>;
  deleteCommunityStory(id: number): Promise<void>;
  updateCommunityStoryViewCount(id: number): Promise<void>;

  // FAQ System
  getFaqs(category?: string, language?: string): Promise<Faq[]>;
  getFaq(id: number): Promise<Faq | undefined>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq>;
  deleteFaq(id: number): Promise<void>;
  updateFaqViewCount(id: number): Promise<void>;

  // Support Tickets
  getSupportTickets(status?: string, priority?: string, assignedTo?: number): Promise<SupportTicket[]>;
  getSupportTicket(id: number): Promise<SupportTicket | undefined>;
  getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | undefined>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: number, ticket: Partial<InsertSupportTicket>): Promise<SupportTicket>;
  getTicketResponses(ticketId: number): Promise<TicketResponse[]>;
  createTicketResponse(response: InsertTicketResponse): Promise<TicketResponse>;

  // Backup and Disaster Recovery
  getBackupLogs(backupType?: string, limit?: number): Promise<BackupLog[]>;
  createBackupLog(log: InsertBackupLog): Promise<BackupLog>;
  updateBackupLog(id: number, log: Partial<InsertBackupLog>): Promise<BackupLog>;
  getDisasterRecoveryTests(status?: string): Promise<DisasterRecoveryTest[]>;
  createDisasterRecoveryTest(test: InsertDisasterRecoveryTest): Promise<DisasterRecoveryTest>;
  updateDisasterRecoveryTest(id: number, test: Partial<InsertDisasterRecoveryTest>): Promise<DisasterRecoveryTest>;

  // User Notifications
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;
  updateUserNotification(userId: number, updates: Partial<UserNotification>): Promise<void>;
  getUserNotifications(userId: number): Promise<UserNotification[]>;
  getUnverifiedUsers(): Promise<User[]>;
  updateUserVerificationReminder(userId: number, updates: { lastVerificationReminder: Date; verificationReminderCount: number }): Promise<void>;
  getNotificationStats(): Promise<{
    totalSent: number;
    todaySent: number;
    failed: number;
    byType: Record<string, number>;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private draws: Map<number, LotteryDraw> = new Map();
  private tickets: Map<number, Ticket> = new Map();
  private transactions: Map<number, Transaction> = new Map();
  private agentSales: Map<number, AgentSale> = new Map();
  private agentCommissions: Map<number, any> = new Map();
  private agentPayments: Map<number, any> = new Map();
  private agentTargets: Map<number, any> = new Map();
  private kycDocuments: Map<number, KycDocument> = new Map();
  private sessions: Map<string, Session> = new Map();
  
  private currentUserId = 1;
  private currentDrawId = 1;
  private currentTicketId = 1;
  private currentTransactionId = 1;
  private currentAgentSaleId = 1;
  private currentKycDocumentId = 1;
  private vrfSeeds: Map<number, VrfSeed> = new Map();
  private currentVrfSeedId = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    // No demo data - start with empty state
    // Users will be created through registration
    this.currentUserId = 1;

    // Initialize counter for IDs
    this.currentDrawId = 1;
    this.currentTicketId = 1;
    this.currentTransactionId = 1;
    this.currentAgentSaleId = 1;
    this.currentCommissionId = 1;
    this.currentPaymentId = 1;
    this.currentTargetId = 1;
    this.currentKycDocumentId = 1;
    this.currentVrfSeedId = 1;

    // No demo data - system starts empty
    
    // Add sample trilingual FAQ data for testing
    this.initializeSampleFAQs();
  }

  private initializeSampleFAQs() {
    // Sample trilingual FAQ data for testing
    const sampleFAQs = [
      {
        question: "How do I purchase lottery tickets?",
        questionShona: "Ndinotenga sei matikiti elottery?",
        questionNdebele: "Ngithengenjani amatikithi e-lottery?",
        answer: "You can purchase tickets through our mobile app, website, or from authorized agents. Simply select your numbers or use Quick Pick, then pay using EcoCash or your wallet balance.",
        answerShona: "Unogona kutenga matikiti kuburikidza ne app yedu, website, kana kubva kuvatengi vakatenderwa. Sarudza nhamba dzako kana ushandise Quick Pick, wobhadhara uchishandisa EcoCash kana mari yako mu wallet.",
        answerNdebele: "Ungakhetha amatikithi nge-app yethu, iwebhusayithi, noma kubathengisi abagunyaziwe. Khetha izinombolo zakho noma usebenzise i-Quick Pick, ubesesubhadala usebenzisa i-EcoCash noma imali yakho ye-wallet.",
        category: "tickets",
        priority: 10,
        createdBy: 1
      },
      {
        question: "What payment methods do you accept?",
        questionShona: "Ndedzipi nzira dzekubhadhara dzamunogamuchira?",
        questionNdebele: "Yiziphi izindlela zokukhokha ezimukelekayo?",
        answer: "We accept EcoCash payments and wallet top-ups. You can add funds to your wallet and use them for ticket purchases.",
        answerShona: "Tinogamuchira kubhadhara kweEcoCash nekuwedzera mari mu wallet. Unogona kuwedzera mari mu wallet yako uye kuishandisa kutenga matikiti.",
        answerNdebele: "Samukela ukukhokha nge-EcoCash kanye nokufaka imali e-wallet. Ungakwazi ukufaka imali e-wallet yakho uyisebenzise ukuthenga amatikithi.",
        category: "payments",
        priority: 9,
        createdBy: 1
      },
      {
        question: "How do I check lottery results?",
        questionShona: "Ndinoona sei zvakabuda mu lottery?",
        questionNdebele: "Ngibona kanjani imiphumela ye-lottery?",
        answer: "Results are available on our website, mobile app, and sent via SMS to winners. You can also check your ticket history in your account.",
        answerShona: "Zvakabuda zvinowanikwa pa website yedu, mobile app, uye zvinotumirwa ne SMS kuvakundi. Unogona zvakare kuona nhoroondo ye matikiti ako mu account yako.",
        answerNdebele: "Imiphumela iyatholakala ku website yethu, i-mobile app, futhi ithunyelwa nge-SMS kubaphumeleli. Ungabona futhi umlando wamatikithi akho e-akhawuntini yakho.",
        category: "general",
        priority: 8,
        createdBy: 1
      },
      {
        question: "How do I become an agent?",
        questionShona: "Ndinova mutengesi sei?",
        questionNdebele: "Ngingaba umthengisi kanjani?",
        answer: "Contact our support team to apply for agent status. You'll need to complete verification and training before you can sell tickets.",
        answerShona: "Taura ne support team yedu kuti uende agent status. Unofanira kupedza verification ne training usati wakwanisa kutengesa matikiti.",
        answerNdebele: "Xhumana neqembu lethu lokusekela ukufaka isicelo se-agent status. Udinga ukuqedela ukuqinisekisa nokuqeqeshwa ngaphambi kokuba ukwazi ukuthengisa amatikithi.",
        category: "agent",
        priority: 7,
        createdBy: 1
      },
      {
        question: "What if I can't access my account?",
        questionShona: "Chii kana ndisingakwanise kupinda mu account yangu?",
        questionNdebele: "Kuthiwani uma ngingakwazi ukufinyelela i-akhawunti yami?",
        answer: "Use the password reset feature or contact our technical support team. Have your phone number ready for verification.",
        answerShona: "Shandisa password reset feature kana taura ne technical support team yedu. Iva ne phone number yako yakagadzirira verification.",
        answerNdebele: "Sebenzisa i-password reset feature noma uxhumane neqembu lethu lokusekela lobuchwepheshe. Yiba nenombolo yakho yefoni ulungele ukuqinisekisa.",
        category: "technical",
        priority: 6,
        createdBy: 1
      }
    ];

    for (const faq of sampleFAQs) {
      this.createFaq(faq);
    }
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.phone === phone);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Check if user with this phone number already exists
    const existingUser = await this.getUserByPhone(insertUser.phone);
    if (existingUser) {
      throw new Error("A user with this phone number already exists");
    }
    
    const id = this.currentUserId++;
    const user: User = {
      ...insertUser,
      id,
      balance: insertUser.balance || "0.00",
      isAgent: insertUser.isAgent || false,
      isAdmin: insertUser.isAdmin || false,
      kycVerified: insertUser.kycVerified || false,
      isFrozen: insertUser.isFrozen || false,
      isBanned: insertUser.isBanned || false,
      passwordHash: insertUser.passwordHash || null,
      agentCode: insertUser.agentCode || null,
      commissionRate: insertUser.commissionRate || null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserBalance(userId: number, amount: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, balance: amount };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Admin functions
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllAgents(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.isAgent)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async freezeUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, isFrozen: true };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async unfreezeUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, isFrozen: false };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async banUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, isBanned: true };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async unbanUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, isBanned: false };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async makeUserAdmin(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, isAdmin: true };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Lottery Draws
  async getLatestDraw(type: 'daily' | 'weekly'): Promise<LotteryDraw | undefined> {
    const draws = Array.from(this.draws.values())
      .filter(draw => draw.type === type && draw.isComplete)
      .sort((a, b) => b.drawDate.getTime() - a.drawDate.getTime());
    return draws[0];
  }

  async getUpcomingDraw(type: 'daily' | 'weekly'): Promise<LotteryDraw | undefined> {
    const draws = Array.from(this.draws.values())
      .filter(draw => draw.type === type && !draw.isComplete)
      .sort((a, b) => a.drawDate.getTime() - b.drawDate.getTime());
    return draws[0];
  }

  async createDraw(insertDraw: InsertLotteryDraw): Promise<LotteryDraw> {
    const id = this.currentDrawId++;
    const draw: LotteryDraw = {
      ...insertDraw,
      id,
      winningNumbers: Array.isArray(insertDraw.winningNumbers) ? insertDraw.winningNumbers : [],
      jackpotAmount: insertDraw.jackpotAmount,
      totalTickets: insertDraw.totalTickets || 0,
      isComplete: insertDraw.isComplete || false,
      blockchainHash: insertDraw.blockchainHash || null,
      createdAt: new Date(),
    };
    this.draws.set(id, draw);
    return draw;
  }

  async completeDraw(drawId: number, winningNumbers: number[], blockchainHash: string): Promise<LotteryDraw> {
    const draw = this.draws.get(drawId);
    if (!draw) throw new Error("Draw not found");
    
    const updatedDraw = { 
      ...draw, 
      winningNumbers, 
      blockchainHash, 
      isComplete: true 
    };
    this.draws.set(drawId, updatedDraw);
    return updatedDraw;
  }

  async getAllDraws(): Promise<LotteryDraw[]> {
    return Array.from(this.draws.values()).sort((a, b) => b.drawDate.getTime() - a.drawDate.getTime());
  }

  async updateDrawJackpot(drawId: number, jackpotAmount: string): Promise<LotteryDraw> {
    const draw = this.draws.get(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }
    
    const updatedDraw = { ...draw, jackpotAmount };
    this.draws.set(drawId, updatedDraw);
    return updatedDraw;
  }

  async getDraw(drawId: number): Promise<LotteryDraw | undefined> {
    return this.draws.get(drawId);
  }

  async updateDraw(drawId: number, updates: Partial<LotteryDraw>): Promise<LotteryDraw> {
    const draw = this.draws.get(drawId);
    if (!draw) {
      throw new Error('Draw not found');
    }
    
    const updatedDraw = { ...draw, ...updates };
    this.draws.set(drawId, updatedDraw);
    return updatedDraw;
  }

  async deleteDraw(drawId: number): Promise<void> {
    this.draws.delete(drawId);
  }

  // Tickets
  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    // Check for duplicate number combinations in the same draw
    const existingTicketsForDraw = Array.from(this.tickets.values())
      .filter(ticket => ticket.drawId === insertTicket.drawId);
      
    // Sort selected numbers for consistent comparison
    const sortedSelectedNumbers = [...insertTicket.selectedNumbers].sort((a, b) => a - b);
    
    for (const existingTicket of existingTicketsForDraw) {
      const existingSortedNumbers = [...existingTicket.selectedNumbers].sort((a, b) => a - b);
      
      // Check if the number combinations are identical
      if (JSON.stringify(sortedSelectedNumbers) === JSON.stringify(existingSortedNumbers)) {
        throw new Error("These numbers have already been selected by another player for this draw. Please choose different numbers.");
      }
    }
    
    const id = this.currentTicketId++;
    // Generate unique ticket number with timestamp to prevent duplicates
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const ticketNumber = `MT${timestamp}${randomSuffix}`;
    
    // Ensure ticket number is truly unique
    let attempts = 0;
    let finalTicketNumber = ticketNumber;
    while (Array.from(this.tickets.values()).some(t => t.ticketNumber === finalTicketNumber) && attempts < 10) {
      attempts++;
      const newRandom = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      finalTicketNumber = `MT${timestamp}${newRandom}`;
    }
    
    const ticket: Ticket = {
      ...insertTicket,
      id,
      ticketNumber: finalTicketNumber,
      selectedNumbers: Array.isArray(insertTicket.selectedNumbers) ? insertTicket.selectedNumbers : [],
      cost: insertTicket.cost,
      matchedNumbers: null,
      prizeAmount: null,
      isWinner: false,
      agentId: insertTicket.agentId || null,
      createdAt: new Date(),
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async getTicketsByUser(userId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTicketsByDraw(drawId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).filter(ticket => ticket.drawId === drawId);
  }

  async getAllTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateTicketResults(ticketId: number, matchedNumbers: number, prizeAmount: string, isWinner: boolean): Promise<Ticket> {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new Error("Ticket not found");
    
    const updatedTicket = { 
      ...ticket, 
      matchedNumbers, 
      prizeAmount, 
      isWinner 
    };
    this.tickets.set(ticketId, updatedTicket);
    return updatedTicket;
  }

  // Transactions
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      paymentMethod: insertTransaction.paymentMethod || null,
      status: insertTransaction.status || "completed",
      ecocashReference: insertTransaction.ecocashReference ?? null,
      failureReason: insertTransaction.failureReason ?? null,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getTransactionsByUser(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateTransactionStatus(transactionId: number, status: string, failureReason?: string): Promise<Transaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const updatedTransaction: Transaction = {
      ...transaction,
      status,
      failureReason: failureReason || transaction.failureReason,
    };

    this.transactions.set(transactionId, updatedTransaction);
    return updatedTransaction;
  }

  // Agent Sales
  async createAgentSale(insertSale: InsertAgentSale): Promise<AgentSale> {
    const id = this.currentAgentSaleId++;
    const sale: AgentSale = {
      ...insertSale,
      id,
      createdAt: new Date(),
    };
    this.agentSales.set(id, sale);
    return sale;
  }

  async getAgentSales(agentId: number, startDate?: Date, endDate?: Date): Promise<AgentSale[]> {
    let sales = Array.from(this.agentSales.values()).filter(sale => sale.agentId === agentId);
    
    if (startDate) {
      sales = sales.filter(sale => sale.createdAt >= startDate);
    }
    if (endDate) {
      sales = sales.filter(sale => sale.createdAt <= endDate);
    }
    
    return sales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Agent Commission Tracking Methods
  async calculateAgentCommission(agentId: number, periodStart: Date, periodEnd: Date): Promise<any> {
    const sales = await this.getAgentSales(agentId, periodStart, periodEnd);
    const totalSales = sales.reduce((sum: number, sale: AgentSale) => sum + parseFloat(sale.commission), 0);
    const totalCommission = sales.reduce((sum: number, sale: AgentSale) => sum + parseFloat(sale.commission), 0);
    const ticketsSold = sales.length;

    const commission = {
      id: this.currentAgentCommissionId++,
      agentId,
      periodStart,
      periodEnd,
      totalSales: totalSales.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      ticketsSold,
      status: 'pending',
      paidAt: null,
      paymentMethod: null,
      paymentReference: null,
      createdAt: new Date()
    };

    this.agentCommissions.set(commission.id, commission);
    return commission;
  }

  async getAgentCommissions(agentId: number, limit?: number): Promise<any[]> {
    const commissions = Array.from(this.agentCommissions.values())
      .filter((commission: any) => commission.agentId === agentId)
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

    return limit ? commissions.slice(0, limit) : commissions;
  }

  async markCommissionPaid(commissionId: number, paymentMethod: string, paymentReference: string): Promise<any> {
    const commission = this.agentCommissions.get(commissionId);
    if (!commission) {
      throw new Error('Commission not found');
    }

    commission.status = 'paid';
    commission.paidAt = new Date();
    commission.paymentMethod = paymentMethod;
    commission.paymentReference = paymentReference;

    this.agentCommissions.set(commissionId, commission);
    return commission;
  }

  // Agent Payment Methods
  async createAgentPayment(payment: any): Promise<any> {
    const newPayment = {
      id: this.currentAgentPaymentId++,
      ...payment,
      createdAt: new Date()
    };

    this.agentPayments.set(newPayment.id, newPayment);
    return newPayment;
  }

  async getAgentPayments(agentId: number): Promise<any[]> {
    return Array.from(this.agentPayments.values())
      .filter((payment: any) => payment.agentId === agentId)
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updatePaymentStatus(paymentId: number, status: 'completed' | 'failed', failureReason?: string): Promise<any> {
    const payment = this.agentPayments.get(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    payment.status = status;
    payment.processedAt = new Date();
    if (failureReason) {
      payment.failureReason = failureReason;
    }

    this.agentPayments.set(paymentId, payment);
    return payment;
  }

  // Agent Target Methods
  async createAgentTarget(target: any): Promise<any> {
    const newTarget = {
      id: this.currentAgentTargetId++,
      ...target,
      achieved: false,
      createdAt: new Date()
    };

    this.agentTargets.set(newTarget.id, newTarget);
    return newTarget;
  }

  async getAgentTargets(agentId: number): Promise<any[]> {
    return Array.from(this.agentTargets.values())
      .filter((target: any) => target.agentId === agentId)
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async checkTargetAchievement(agentId: number, targetId: number): Promise<any> {
    const target = this.agentTargets.get(targetId);
    if (!target || target.agentId !== agentId) {
      throw new Error('Target not found');
    }

    const sales = await this.getAgentSales(agentId, target.startDate, target.endDate);
    const totalSales = sales.reduce((sum: number, sale: AgentSale) => sum + parseFloat(sale.commission), 0);
    const ticketsSold = sales.length;

    const achieved = totalSales >= parseFloat(target.salesTarget) && ticketsSold >= target.ticketsTarget;
    
    target.achieved = achieved;
    this.agentTargets.set(targetId, target);
    
    return target;
  }

  // Agent Analytics Methods
  async getAgentPerformanceStats(agentId: number, startDate: Date, endDate: Date): Promise<any> {
    const sales = await this.getAgentSales(agentId, startDate, endDate);
    const totalSales = sales.reduce((sum: number, sale: AgentSale) => sum + parseFloat(sale.commission), 0);
    const totalCommission = sales.reduce((sum: number, sale: AgentSale) => sum + parseFloat(sale.commission), 0);
    const ticketsSold = sales.length;

    // Calculate daily averages
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgDailySales = totalSales / daysDiff;
    const avgDailyTickets = ticketsSold / daysDiff;

    return {
      agentId,
      periodStart: startDate,
      periodEnd: endDate,
      totalSales: totalSales.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      ticketsSold,
      avgDailySales: avgDailySales.toFixed(2),
      avgDailyTickets: Math.round(avgDailyTickets),
    };
  }

  async getTopPerformingAgents(period: 'weekly' | 'monthly', limit: number = 10): Promise<any[]> {
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === 'weekly') {
      startDate.setDate(endDate.getDate() - 7);
    } else {
      startDate.setMonth(endDate.getMonth() - 1);
    }

    // Get all agents
    const agents = Array.from(this.users.values()).filter(user => user.isAgent);
    
    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const stats = await this.getAgentPerformanceStats(agent.id, startDate, endDate);
        return {
          ...stats,
          agentName: agent.name,
          agentCode: agent.agentCode
        };
      })
    );

    return agentStats
      .sort((a, b) => parseFloat(b.totalSales) - parseFloat(a.totalSales))
      .slice(0, limit);
  }

  private currentAgentCommissionId = 1;
  private currentAgentPaymentId = 1;
  private currentAgentTargetId = 1;

  // KYC Document methods
  async uploadKycDocument(insertDocument: InsertKycDocument): Promise<KycDocument> {
    const document: KycDocument = {
      id: this.currentKycDocumentId++,
      userId: insertDocument.userId,
      documentType: insertDocument.documentType,
      fileName: insertDocument.fileName || null,
      fileUrl: insertDocument.fileUrl || null,
      nationalId: insertDocument.nationalId || null,
      status: insertDocument.status || 'pending',
      verificationMethod: insertDocument.verificationMethod || 'manual',
      apiResponse: insertDocument.apiResponse || null,
      failureReason: insertDocument.failureReason || null,
      uploadedAt: new Date(),
      verifiedAt: null,
    };

    this.kycDocuments.set(document.id, document);
    return document;
  }

  async getKycDocuments(userId: number): Promise<KycDocument[]> {
    return Array.from(this.kycDocuments.values()).filter(doc => doc.userId === userId);
  }

  async updateKycStatus(
    documentId: number, 
    status: 'approved' | 'rejected' | 'failed', 
    apiResponse?: any, 
    failureReason?: string
  ): Promise<KycDocument> {
    const document = this.kycDocuments.get(documentId);
    if (!document) {
      throw new Error('KYC document not found');
    }

    const updatedDocument: KycDocument = {
      ...document,
      status,
      apiResponse: apiResponse || document.apiResponse,
      failureReason: failureReason || document.failureReason,
      verifiedAt: status === 'approved' ? new Date() : document.verifiedAt,
    };

    this.kycDocuments.set(documentId, updatedDocument);

    // Update user KYC status if approved
    if (status === 'approved') {
      const user = this.users.get(document.userId);
      if (user) {
        const updatedUser = { ...user, kycVerified: true };
        this.users.set(user.id, updatedUser);
      }
    }

    return updatedDocument;
  }

  async verifyNationalId(
    userId: number, 
    nationalId: string, 
    firstName?: string, 
    lastName?: string
  ): Promise<KycDocument> {
    // First, create a KYC document for this verification attempt
    const document = await this.uploadKycDocument({
      userId,
      documentType: 'national_id_api',
      nationalId,
      verificationMethod: 'api',
      status: 'pending',
    });

    try {
      // Import the Zimbabwe National ID service dynamically to avoid circular dependencies
      const { zimbabweNationalIdService } = await import('./national-id-api');
      
      // Perform the API verification
      const apiResponse = await zimbabweNationalIdService.verifyNationalId({
        nationalId,
        firstName,
        lastName,
      });

      // Update the document based on API response
      if (apiResponse.success && apiResponse.verified) {
        return await this.updateKycStatus(
          document.id,
          'approved',
          apiResponse,
          undefined
        );
      } else {
        return await this.updateKycStatus(
          document.id,
          'failed',
          apiResponse,
          apiResponse.failureReason || 'Verification failed'
        );
      }
    } catch (error) {
      console.error('National ID verification error:', error);
      return await this.updateKycStatus(
        document.id,
        'failed',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'API verification service unavailable'
      );
    }
  }

  async createVrfSeed(drawId: number): Promise<VrfSeed> {
    const seed: VrfSeed = {
      id: this.currentVrfSeedId++,
      drawId,
      seedValue: this.generateSecureRandomSeed(),
      publicKey: this.generatePublicKey(),
      proof: this.generateVrfProof(),
      output: this.generateVrfOutput(),
      createdAt: new Date()
    };
    
    this.vrfSeeds.set(drawId, seed);
    return seed;
  }

  async getVrfSeed(drawId: number): Promise<VrfSeed | undefined> {
    return this.vrfSeeds.get(drawId);
  }

  // Session Management
  async createSession(userId: number): Promise<Session> {
    const sessionId = `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const session: Session = {
      id: sessionId,
      userId,
      expiresAt,
      createdAt: new Date(),
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (session && session.expiresAt > new Date()) {
      return session;
    }
    if (session) {
      // Session expired, remove it
      this.sessions.delete(sessionId);
    }
    return undefined;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  private generateSecureRandomSeed(): string {
    // Generate cryptographically secure random seed
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `seed_${timestamp}_${random}`;
  }

  private generatePublicKey(): string {
    return `pub_${Math.random().toString(36).substring(2)}`;
  }

  private generateVrfProof(): string {
    return `proof_${Math.random().toString(36).substring(2)}`;
  }

  private generateVrfOutput(): string {
    return `output_${Math.random().toString(36).substring(2)}`;
  }

  // Admin User Management Methods
  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // In a real app, you'd hash the password here
    const updatedUser = { ...user, passwordHash: newPassword };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async freezeUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = { ...user, isFrozen: !user.isFrozen };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async unfreezeUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = { ...user, isFrozen: false };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async banUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = { ...user, isBanned: !user.isBanned };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async unbanUser(userId: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = { ...user, isBanned: false };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getPendingKycDocuments(): Promise<KycDocument[]> {
    const pendingDocs = Array.from(this.kycDocuments.values())
      .filter(doc => doc.status === 'pending');
    
    // Add user information to each document
    return pendingDocs.map(doc => ({
      ...doc,
      user: this.users.get(doc.userId)
    }));
  }

  async getKycDocument(documentId: number): Promise<KycDocument | undefined> {
    const document = this.kycDocuments.get(documentId);
    if (!document) {
      return undefined;
    }

    return {
      ...document,
      user: this.users.get(document.userId)
    };
  }

  async getUpcomingDraws(): Promise<any> {
    return {
      daily: this.getUpcomingDraw('daily'),
      weekly: this.getUpcomingDraw('weekly')
    };
  }

  // Community Stories - MemStorage implementation
  private communityStories: Map<number, CommunityStory> = new Map();
  private currentCommunityStoryId = 1;

  async getCommunityStories(status?: string, featured?: boolean): Promise<CommunityStory[]> {
    const stories = Array.from(this.communityStories.values());
    return stories
      .filter(story => !status || story.status === status)
      .filter(story => featured === undefined || story.featured === featured)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getCommunityStory(id: number): Promise<CommunityStory | undefined> {
    return this.communityStories.get(id);
  }

  async createCommunityStory(story: InsertCommunityStory): Promise<CommunityStory> {
    const newStory: CommunityStory = {
      id: this.currentCommunityStoryId++,
      ...story,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: story.status === 'published' ? new Date() : null
    };
    this.communityStories.set(newStory.id, newStory);
    return newStory;
  }

  async updateCommunityStory(id: number, story: Partial<InsertCommunityStory>): Promise<CommunityStory> {
    const existing = this.communityStories.get(id);
    if (!existing) throw new Error('Community story not found');
    
    const updated: CommunityStory = {
      ...existing,
      ...story,
      updatedAt: new Date(),
      publishedAt: story.status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt
    };
    this.communityStories.set(id, updated);
    return updated;
  }

  async deleteCommunityStory(id: number): Promise<void> {
    this.communityStories.delete(id);
  }

  async updateCommunityStoryViewCount(id: number): Promise<void> {
    const story = this.communityStories.get(id);
    if (story) {
      story.viewCount = (story.viewCount || 0) + 1;
      this.communityStories.set(id, story);
    }
  }

  // FAQ System - MemStorage implementation
  private faqs: Map<number, Faq> = new Map();
  private currentFaqId = 1;

  async getFaqs(category?: string, language?: string): Promise<Faq[]> {
    const faqs = Array.from(this.faqs.values());
    return faqs
      .filter(faq => faq.isActive)
      .filter(faq => !category || faq.category === category)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async getFaq(id: number): Promise<Faq | undefined> {
    return this.faqs.get(id);
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const newFaq: Faq = {
      id: this.currentFaqId++,
      ...faq,
      priority: faq.priority || 0,
      isActive: true,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.faqs.set(newFaq.id, newFaq);
    return newFaq;
  }

  async updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq> {
    const existing = this.faqs.get(id);
    if (!existing) throw new Error('FAQ not found');
    
    const updated: Faq = {
      ...existing,
      ...faq,
      updatedAt: new Date()
    };
    this.faqs.set(id, updated);
    return updated;
  }

  async deleteFaq(id: number): Promise<void> {
    this.faqs.delete(id);
  }

  async updateFaqViewCount(id: number): Promise<void> {
    const faq = this.faqs.get(id);
    if (faq) {
      faq.viewCount = (faq.viewCount || 0) + 1;
      this.faqs.set(id, faq);
    }
  }

  // Support Tickets - MemStorage implementation
  private supportTickets: Map<number, SupportTicket> = new Map();
  private ticketResponses: Map<number, TicketResponse> = new Map();
  private currentSupportTicketId = 1;
  private currentTicketResponseId = 1;

  async getSupportTickets(status?: string, priority?: string, assignedTo?: number): Promise<SupportTicket[]> {
    const tickets = Array.from(this.supportTickets.values());
    return tickets
      .filter(ticket => !status || ticket.status === status)
      .filter(ticket => !priority || ticket.priority === priority)
      .filter(ticket => !assignedTo || ticket.assignedTo === assignedTo)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    return this.supportTickets.get(id);
  }

  async getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | undefined> {
    for (const ticket of this.supportTickets.values()) {
      if (ticket.ticketNumber === ticketNumber) {
        return ticket;
      }
    }
    return undefined;
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const newTicket: SupportTicket = {
      id: this.currentSupportTicketId++,
      ticketNumber,
      ...ticket,
      priority: ticket.priority || 'medium',
      status: ticket.status || 'open',
      language: ticket.language || 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      satisfactionRating: null,
      resolutionNotes: null,
      assignedTo: null,
      attachments: null
    };
    this.supportTickets.set(newTicket.id, newTicket);
    return newTicket;
  }

  async updateSupportTicket(id: number, ticket: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const existing = this.supportTickets.get(id);
    if (!existing) throw new Error('Support ticket not found');
    
    const updated: SupportTicket = {
      ...existing,
      ...ticket,
      updatedAt: new Date(),
      resolvedAt: ticket.status === 'resolved' && !existing.resolvedAt ? new Date() : existing.resolvedAt
    };
    this.supportTickets.set(id, updated);
    return updated;
  }

  async getTicketResponses(ticketId: number): Promise<TicketResponse[]> {
    const responses = Array.from(this.ticketResponses.values());
    return responses
      .filter(response => response.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }

  async createTicketResponse(response: InsertTicketResponse): Promise<TicketResponse> {
    const newResponse: TicketResponse = {
      id: this.currentTicketResponseId++,
      ...response,
      isPublic: response.isPublic !== false,
      attachments: null,
      createdAt: new Date()
    };
    this.ticketResponses.set(newResponse.id, newResponse);
    return newResponse;
  }

  // Backup and Disaster Recovery - MemStorage implementation
  private backupLogs: Map<number, BackupLog> = new Map();
  private disasterRecoveryTests: Map<number, DisasterRecoveryTest> = new Map();
  private currentBackupLogId = 1;
  private currentDisasterTestId = 1;

  async getBackupLogs(backupType?: string, limit: number = 50): Promise<BackupLog[]> {
    const logs = Array.from(this.backupLogs.values());
    const filtered = logs.filter(log => !backupType || log.backupType === backupType);
    return filtered
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);
  }

  async createBackupLog(log: InsertBackupLog): Promise<BackupLog> {
    const newLog: BackupLog = {
      id: this.currentBackupLogId++,
      ...log,
      encryptionStatus: log.encryptionStatus || 'encrypted',
      integrityCheck: log.integrityCheck || false,
      createdAt: new Date(),
      completedAt: null,
      errorMessage: null,
      backupSize: null,
      backupLocation: null
    };
    this.backupLogs.set(newLog.id, newLog);
    return newLog;
  }

  async updateBackupLog(id: number, log: Partial<InsertBackupLog>): Promise<BackupLog> {
    const existing = this.backupLogs.get(id);
    if (!existing) throw new Error('Backup log not found');
    
    const updated: BackupLog = {
      ...existing,
      ...log
    };
    this.backupLogs.set(id, updated);
    return updated;
  }

  async getDisasterRecoveryTests(status?: string): Promise<DisasterRecoveryTest[]> {
    const tests = Array.from(this.disasterRecoveryTests.values());
    return tests
      .filter(test => !status || test.status === status)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createDisasterRecoveryTest(test: InsertDisasterRecoveryTest): Promise<DisasterRecoveryTest> {
    const newTest: DisasterRecoveryTest = {
      id: this.currentDisasterTestId++,
      ...test,
      createdAt: new Date(),
      completedAt: null,
      results: null,
      recoveryTime: null,
      dataLoss: null,
      improvementNotes: null,
      nextTestDate: null,
      scheduledAt: null
    };
    this.disasterRecoveryTests.set(newTest.id, newTest);
    return newTest;
  }

  async updateDisasterRecoveryTest(id: number, test: Partial<InsertDisasterRecoveryTest>): Promise<DisasterRecoveryTest> {
    const existing = this.disasterRecoveryTests.get(id);
    if (!existing) throw new Error('Disaster recovery test not found');
    
    const updated: DisasterRecoveryTest = {
      ...existing,
      ...test,
      completedAt: test.status === 'completed' && !existing.completedAt ? new Date() : existing.completedAt
    };
    this.disasterRecoveryTests.set(id, updated);
    return updated;
  }
}

// Import database storage when DATABASE_URL is available
import { DatabaseStorage } from "./database-storage";

// Use database storage when DATABASE_URL is available, otherwise use memory storage
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
