import { 
  users, lotteryDraws, tickets, transactions, agentSales, agentCommissions, agentPayments, agentTargets, kycDocuments, vrfSeeds, sessions,
  communityStories, faqs, supportTickets, ticketResponses, backupLogs, disasterRecoveryTests,
  type User, type LotteryDraw, type Ticket, type Transaction, type AgentSale, type AgentCommission, type AgentPayment, type AgentTarget,
  type KycDocument, type VrfSeed, type Session, type InsertUser, type InsertLotteryDraw, 
  type InsertTicket, type InsertTransaction, type InsertAgentSale, type InsertAgentCommission, type InsertAgentPayment, type InsertAgentTarget, type InsertKycDocument,
  type InsertVrfSeed, type InsertSession, type LoginData, type RegisterData,
  type CommunityStory, type InsertCommunityStory,
  type Faq, type InsertFaq,
  type SupportTicket, type InsertSupportTicket,
  type TicketResponse, type InsertTicketResponse,
  type BackupLog, type InsertBackupLog,
  type DisasterRecoveryTest, type InsertDisasterRecoveryTest
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Check if user with this phone number already exists
    const existingUser = await this.getUserByPhone(insertUser.phone);
    if (existingUser) {
      throw new Error("A user with this phone number already exists");
    }
    
    const [user] = await db.insert(users).values({
      ...insertUser,
      passwordHash: insertUser.passwordHash || null,
      agentCode: insertUser.agentCode || null,
      commissionRate: insertUser.commissionRate || "0.05"
    }).returning();
    return user;
  }

  async updateUserBalance(userId: number, amount: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ balance: amount })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ passwordHash: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Admin functions
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllAgents(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isAgent, true));
  }

  async freezeUser(userId: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ isFrozen: true })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async unfreezeUser(userId: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ isFrozen: false })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async banUser(userId: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ isBanned: true })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async unbanUser(userId: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ isBanned: false })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async makeUserAdmin(userId: number): Promise<User> {
    const [user] = await db.update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Authentication
  async registerUser(data: RegisterData): Promise<User> {
    // Check if user with this phone number already exists
    const existingUser = await this.getUserByPhone(data.phone);
    if (existingUser) {
      throw new Error("A user with this phone number already exists");
    }
    
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const agentCode = data.isAgent ? this.generateAgentCode() : null;
    
    const [user] = await db.insert(users).values({
      phone: data.phone,
      name: data.name,
      passwordHash: hashedPassword,
      isAgent: data.isAgent,
      agentCode,
      balance: "0.00",
      isAdmin: false,
      kycVerified: false,
      commissionRate: data.isAgent ? "0.05" : null
    }).returning();
    
    return user;
  }

  async authenticateUser(data: LoginData): Promise<User | null> {
    const user = await this.getUserByPhone(data.phone);
    if (!user || !user.passwordHash) return null;
    
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    return isValid ? user : null;
  }

  // Session management
  async createSession(userId: number): Promise<Session> {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const [session] = await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt
    }).returning();
    
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions)
      .where(and(eq(sessions.id, sessionId), gte(sessions.expiresAt, new Date())));
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  // KYC operations
  async uploadKycDocument(document: InsertKycDocument): Promise<KycDocument> {
    const [doc] = await db.insert(kycDocuments).values(document).returning();
    return doc;
  }

  async getKycDocuments(userId: number): Promise<KycDocument[]> {
    return await db.select().from(kycDocuments)
      .where(eq(kycDocuments.userId, userId))
      .orderBy(desc(kycDocuments.uploadedAt));
  }

  async updateKycStatus(documentId: number, status: 'approved' | 'rejected'): Promise<KycDocument> {
    const [doc] = await db.update(kycDocuments)
      .set({ 
        status, 
        verifiedAt: status === 'approved' ? new Date() : null 
      })
      .where(eq(kycDocuments.id, documentId))
      .returning();
    
    // Update user KYC status if approved
    if (status === 'approved') {
      await db.update(users)
        .set({ kycVerified: true })
        .where(eq(users.id, doc.userId));
    }
    
    return doc;
  }

  // VRF operations
  async createVrfSeed(drawId: number): Promise<VrfSeed> {
    const seedValue = crypto.randomBytes(32).toString('hex');
    const { publicKey, proof, output } = this.generateVrfProof(seedValue);
    
    const [vrfSeed] = await db.insert(vrfSeeds).values({
      drawId,
      seedValue,
      publicKey,
      proof,
      output
    }).returning();
    
    return vrfSeed;
  }

  async getVrfSeed(drawId: number): Promise<VrfSeed | undefined> {
    const [seed] = await db.select().from(vrfSeeds)
      .where(eq(vrfSeeds.drawId, drawId));
    return seed;
  }

  // Lottery operations
  async getLatestDraw(type: 'daily' | 'weekly'): Promise<LotteryDraw | undefined> {
    const [draw] = await db.select().from(lotteryDraws)
      .where(and(eq(lotteryDraws.type, type), eq(lotteryDraws.isComplete, true)))
      .orderBy(desc(lotteryDraws.drawDate))
      .limit(1);
    return draw;
  }

  async getUpcomingDraw(type: 'daily' | 'weekly'): Promise<LotteryDraw | undefined> {
    const [draw] = await db.select().from(lotteryDraws)
      .where(and(eq(lotteryDraws.type, type), eq(lotteryDraws.isComplete, false)))
      .orderBy(lotteryDraws.drawDate)
      .limit(1);
    return draw;
  }

  async createDraw(insertDraw: InsertLotteryDraw): Promise<LotteryDraw> {
    const [draw] = await db.insert(lotteryDraws).values(insertDraw).returning();
    return draw;
  }

  async completeDraw(drawId: number, winningNumbers: number[], blockchainHash: string): Promise<LotteryDraw> {
    const [draw] = await db.update(lotteryDraws)
      .set({ 
        winningNumbers, 
        blockchainHash, 
        isComplete: true 
      })
      .where(eq(lotteryDraws.id, drawId))
      .returning();
    return draw;
  }

  async getAllDraws(): Promise<LotteryDraw[]> {
    return await db.select().from(lotteryDraws)
      .orderBy(desc(lotteryDraws.drawDate));
  }

  async getDraw(drawId: number): Promise<LotteryDraw | undefined> {
    const [draw] = await db.select().from(lotteryDraws)
      .where(eq(lotteryDraws.id, drawId));
    return draw;
  }

  async updateDraw(drawId: number, updates: Partial<LotteryDraw>): Promise<LotteryDraw> {
    const [draw] = await db.update(lotteryDraws)
      .set(updates)
      .where(eq(lotteryDraws.id, drawId))
      .returning();
    return draw;
  }

  async deleteDraw(drawId: number): Promise<void> {
    await db.delete(lotteryDraws)
      .where(eq(lotteryDraws.id, drawId));
  }

  // Ticket operations
  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    // Check for duplicate number combinations in the same draw
    const existingTicketsWithNumbers = await db.select()
      .from(tickets)
      .where(eq(tickets.drawId, insertTicket.drawId));
      
    // Sort selected numbers for consistent comparison
    const sortedSelectedNumbers = [...insertTicket.selectedNumbers].sort((a, b) => a - b);
    
    for (const existingTicket of existingTicketsWithNumbers) {
      const existingSortedNumbers = [...existingTicket.selectedNumbers].sort((a, b) => a - b);
      
      // Check if the number combinations are identical
      if (JSON.stringify(sortedSelectedNumbers) === JSON.stringify(existingSortedNumbers)) {
        throw new Error("These numbers have already been selected by another player for this draw. Please choose different numbers.");
      }
    }
    
    // Generate unique ticket number with database collision check
    let ticketNumber = this.generateTicketNumber();
    let attempts = 0;
    
    // Ensure ticket number is unique in database
    while (attempts < 10) {
      const existingTicket = await db.select()
        .from(tickets)
        .where(eq(tickets.ticketNumber, ticketNumber))
        .limit(1);
        
      if (existingTicket.length === 0) {
        break; // Unique ticket number found
      }
      
      attempts++;
      ticketNumber = this.generateTicketNumber();
    }
    
    const [ticket] = await db.insert(tickets).values({
      ...insertTicket,
      ticketNumber,
      selectedNumbers: insertTicket.selectedNumbers,
      matchedNumbers: 0,
      prizeAmount: "0.00",
      isWinner: false
    }).returning();
    return ticket;
  }

  async getTicketsByUser(userId: number): Promise<Ticket[]> {
    return await db.select().from(tickets)
      .where(eq(tickets.userId, userId))
      .orderBy(desc(tickets.createdAt));
  }

  async getTicketsByDraw(drawId: number): Promise<Ticket[]> {
    return await db.select().from(tickets)
      .where(eq(tickets.drawId, drawId));
  }

  async getAllTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets)
      .orderBy(desc(tickets.createdAt));
  }

  async updateTicketResults(ticketId: number, matchedNumbers: number, prizeAmount: string, isWinner: boolean): Promise<Ticket> {
    const [ticket] = await db.update(tickets)
      .set({ matchedNumbers, prizeAmount, isWinner })
      .where(eq(tickets.id, ticketId))
      .returning();
    return ticket;
  }

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async getTransactionsByUser(userId: number): Promise<Transaction[]> {
    return await db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  // Agent operations
  async createAgentSale(insertSale: InsertAgentSale): Promise<AgentSale> {
    const [sale] = await db.insert(agentSales).values(insertSale).returning();
    return sale;
  }

  async getAgentSales(agentId: number, startDate?: Date, endDate?: Date): Promise<AgentSale[]> {
    let query = db.select().from(agentSales).where(eq(agentSales.agentId, agentId));
    
    if (startDate) {
      query = query.where(and(
        eq(agentSales.agentId, agentId),
        gte(agentSales.createdAt, startDate)
      ));
    }
    
    if (endDate) {
      query = query.where(and(
        eq(agentSales.agentId, agentId),
        lte(agentSales.createdAt, endDate)
      ));
    }
    
    return await query.orderBy(desc(agentSales.createdAt));
  }

  // Agent Commission methods
  async calculateAgentCommission(agentId: number, periodStart: Date, periodEnd: Date): Promise<AgentCommission> {
    // Get all agent sales in the period
    const sales = await this.getAgentSales(agentId, periodStart, periodEnd);
    
    const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.ticketPrice), 0);
    const salesCount = sales.length;
    
    // Get agent's commission rate
    const agent = await this.getUser(agentId);
    const commissionRate = parseFloat(agent?.commissionRate || "0.05");
    const totalCommission = totalSales * commissionRate;
    
    // Create or update commission record
    const [commission] = await db.insert(agentCommissions).values({
      agentId,
      amount: totalCommission.toFixed(2),
      period: `${periodStart.getFullYear()}-${(periodStart.getMonth() + 1).toString().padStart(2, '0')}`,
      salesCount,
      totalSales: totalSales.toFixed(2),
      status: 'pending',
      calculatedAt: new Date(),
    } as InsertAgentCommission).returning();
    
    return commission;
  }

  async getAgentCommissions(agentId: number, limit: number = 50): Promise<AgentCommission[]> {
    return await db.select()
      .from(agentCommissions)
      .where(eq(agentCommissions.agentId, agentId))
      .orderBy(desc(agentCommissions.calculatedAt))
      .limit(limit);
  }

  async markCommissionPaid(commissionId: number, paymentMethod: string, paymentReference: string): Promise<AgentCommission> {
    const [commission] = await db.update(agentCommissions)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paymentMethod,
        paymentReference,
      })
      .where(eq(agentCommissions.id, commissionId))
      .returning();
    
    return commission;
  }

  async getAgentPerformanceStats(agentId: number, startDate: Date, endDate: Date): Promise<any> {
    const sales = await this.getAgentSales(agentId, startDate, endDate);
    const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.ticketPrice), 0);
    const avgSaleValue = sales.length > 0 ? totalSales / sales.length : 0;
    
    return {
      totalSales: totalSales.toFixed(2),
      salesCount: sales.length,
      avgSaleValue: avgSaleValue.toFixed(2),
      period: { startDate, endDate }
    };
  }

  async getTopPerformingAgents(period: 'weekly' | 'monthly', limit: number = 10): Promise<any[]> {
    const now = new Date();
    const startDate = period === 'weekly' 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const agents = await this.getAllAgents();
    const agentStats = [];
    
    for (const agent of agents) {
      const stats = await this.getAgentPerformanceStats(agent.id, startDate, now);
      agentStats.push({
        agent,
        ...stats
      });
    }
    
    return agentStats
      .sort((a, b) => parseFloat(b.totalSales) - parseFloat(a.totalSales))
      .slice(0, limit);
  }

  // Agent Payment methods
  async createAgentPayment(payment: InsertAgentPayment): Promise<AgentPayment> {
    const [newPayment] = await db.insert(agentPayments).values(payment).returning();
    return newPayment;
  }

  async getAgentPayments(agentId: number): Promise<AgentPayment[]> {
    return await db.select()
      .from(agentPayments)
      .where(eq(agentPayments.agentId, agentId))
      .orderBy(desc(agentPayments.createdAt));
  }

  async updatePaymentStatus(paymentId: number, status: 'completed' | 'failed', failureReason?: string): Promise<AgentPayment> {
    const [payment] = await db.update(agentPayments)
      .set({
        status,
        failureReason,
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(agentPayments.id, paymentId))
      .returning();
    
    return payment;
  }

  // Agent Target methods
  async createAgentTarget(target: InsertAgentTarget): Promise<AgentTarget> {
    const [newTarget] = await db.insert(agentTargets).values(target).returning();
    return newTarget;
  }

  async getAgentTargets(agentId: number): Promise<AgentTarget[]> {
    return await db.select()
      .from(agentTargets)
      .where(eq(agentTargets.agentId, agentId))
      .orderBy(desc(agentTargets.targetDate));
  }

  async checkTargetAchievement(agentId: number, targetId: number): Promise<AgentTarget> {
    const [target] = await db.select()
      .from(agentTargets)
      .where(and(
        eq(agentTargets.agentId, agentId),
        eq(agentTargets.id, targetId)
      ));
    
    if (!target) throw new Error('Target not found');
    
    // Check achievement based on target criteria
    const stats = await this.getAgentPerformanceStats(agentId, target.targetDate, new Date());
    const achieved = parseFloat(stats.totalSales) >= parseFloat(target.targetAmount);
    
    if (achieved && target.status !== 'achieved') {
      const [updatedTarget] = await db.update(agentTargets)
        .set({
          status: 'achieved',
          achievedAt: new Date(),
        })
        .where(eq(agentTargets.id, targetId))
        .returning();
      
      return updatedTarget;
    }
    
    return target;
  }

  async updateTransactionStatus(transactionId: number, status: string, failureReason?: string): Promise<Transaction> {
    const [transaction] = await db.update(transactions)
      .set({
        status,
        failureReason,
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(transactions.id, transactionId))
      .returning();
    
    return transaction;
  }

  // Helper methods
  private generateTicketNumber(): string {
    return `MT${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  private generateAgentCode(): string {
    return `AG${Math.floor(Math.random() * 900000) + 100000}`;
  }

  private generateVrfProof(seedValue: string): { publicKey: string; proof: string; output: string } {
    // Simple VRF implementation - in production, use a proper VRF library
    const hash = crypto.createHash('sha256').update(seedValue).digest('hex');
    return {
      publicKey: crypto.randomBytes(32).toString('hex'),
      proof: crypto.createHash('sha256').update(hash + 'proof').digest('hex'),
      output: hash
    };
  }

  // Community Stories (Admin managed)
  async getCommunityStories(status?: string, featured?: boolean): Promise<CommunityStory[]> {
    let query = db.select().from(communityStories);
    if (status) {
      query = query.where(eq(communityStories.status, status));
    }
    if (featured !== undefined) {
      query = query.where(eq(communityStories.featured, featured));
    }
    return await query.orderBy(desc(communityStories.createdAt));
  }

  async getCommunityStory(id: number): Promise<CommunityStory | undefined> {
    const result = await db.select().from(communityStories).where(eq(communityStories.id, id));
    return result[0];
  }

  async createCommunityStory(story: InsertCommunityStory): Promise<CommunityStory> {
    const result = await db.insert(communityStories).values(story).returning();
    return result[0];
  }

  async updateCommunityStory(id: number, story: Partial<InsertCommunityStory>): Promise<CommunityStory> {
    const result = await db.update(communityStories)
      .set({ ...story, updatedAt: new Date() })
      .where(eq(communityStories.id, id))
      .returning();
    return result[0];
  }

  async deleteCommunityStory(id: number): Promise<void> {
    await db.delete(communityStories).where(eq(communityStories.id, id));
  }

  async updateCommunityStoryViewCount(id: number): Promise<void> {
    await db.update(communityStories)
      .set({ viewCount: sql`${communityStories.viewCount} + 1` })
      .where(eq(communityStories.id, id));
  }

  // FAQ System
  async getFaqs(category?: string, language?: string): Promise<Faq[]> {
    let query = db.select().from(faqs).where(eq(faqs.isActive, true));
    if (category) {
      query = query.where(eq(faqs.category, category));
    }
    return await query.orderBy(desc(faqs.priority), desc(faqs.createdAt));
  }

  async getFaq(id: number): Promise<Faq | undefined> {
    const result = await db.select().from(faqs).where(eq(faqs.id, id));
    return result[0];
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const result = await db.insert(faqs).values(faq).returning();
    return result[0];
  }

  async updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq> {
    const result = await db.update(faqs)
      .set({ ...faq, updatedAt: new Date() })
      .where(eq(faqs.id, id))
      .returning();
    return result[0];
  }

  async deleteFaq(id: number): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  async updateFaqViewCount(id: number): Promise<void> {
    await db.update(faqs)
      .set({ viewCount: sql`${faqs.viewCount} + 1` })
      .where(eq(faqs.id, id));
  }

  // Support Tickets
  async getSupportTickets(status?: string, priority?: string, assignedTo?: number): Promise<SupportTicket[]> {
    let query = db.select().from(supportTickets);
    if (status) {
      query = query.where(eq(supportTickets.status, status));
    }
    if (priority) {
      query = query.where(eq(supportTickets.priority, priority));
    }
    if (assignedTo) {
      query = query.where(eq(supportTickets.assignedTo, assignedTo));
    }
    return await query.orderBy(desc(supportTickets.createdAt));
  }

  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    const result = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return result[0];
  }

  async getSupportTicketByNumber(ticketNumber: string): Promise<SupportTicket | undefined> {
    const result = await db.select().from(supportTickets).where(eq(supportTickets.ticketNumber, ticketNumber));
    return result[0];
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const result = await db.insert(supportTickets).values({
      ...ticket,
      ticketNumber
    }).returning();
    return result[0];
  }

  async updateSupportTicket(id: number, ticket: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const result = await db.update(supportTickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return result[0];
  }

  async getTicketResponses(ticketId: number): Promise<TicketResponse[]> {
    return await db.select().from(ticketResponses)
      .where(eq(ticketResponses.ticketId, ticketId))
      .orderBy(asc(ticketResponses.createdAt));
  }

  async createTicketResponse(response: InsertTicketResponse): Promise<TicketResponse> {
    const result = await db.insert(ticketResponses).values(response).returning();
    return result[0];
  }

  // Backup and Disaster Recovery
  async getBackupLogs(backupType?: string, limit: number = 50): Promise<BackupLog[]> {
    let query = db.select().from(backupLogs);
    if (backupType) {
      query = query.where(eq(backupLogs.backupType, backupType));
    }
    return await query.orderBy(desc(backupLogs.createdAt)).limit(limit);
  }

  async createBackupLog(log: InsertBackupLog): Promise<BackupLog> {
    const result = await db.insert(backupLogs).values(log).returning();
    return result[0];
  }

  async updateBackupLog(id: number, log: Partial<InsertBackupLog>): Promise<BackupLog> {
    const result = await db.update(backupLogs)
      .set(log)
      .where(eq(backupLogs.id, id))
      .returning();
    return result[0];
  }

  async getDisasterRecoveryTests(status?: string): Promise<DisasterRecoveryTest[]> {
    let query = db.select().from(disasterRecoveryTests);
    if (status) {
      query = query.where(eq(disasterRecoveryTests.status, status));
    }
    return await query.orderBy(desc(disasterRecoveryTests.createdAt));
  }

  async createDisasterRecoveryTest(test: InsertDisasterRecoveryTest): Promise<DisasterRecoveryTest> {
    const result = await db.insert(disasterRecoveryTests).values(test).returning();
    return result[0];
  }

  async updateDisasterRecoveryTest(id: number, test: Partial<InsertDisasterRecoveryTest>): Promise<DisasterRecoveryTest> {
    const result = await db.update(disasterRecoveryTests)
      .set(test)
      .where(eq(disasterRecoveryTests.id, id))
      .returning();
    return result[0];
  }

  // Missing methods needed for admin dashboard
  async getPendingKycDocuments(): Promise<KycDocument[]> {
    return await db.select().from(kycDocuments).where(eq(kycDocuments.status, 'pending'));
  }

  async getUpcomingDraws(): Promise<{ daily?: LotteryDraw; weekly?: LotteryDraw }> {
    const now = new Date();
    
    // Get all upcoming daily draws and filter out weekends
    const allDailyDraws = await db.select().from(lotteryDraws)
      .where(and(
        eq(lotteryDraws.type, 'daily'),
        gte(lotteryDraws.drawDate, now),
        eq(lotteryDraws.isComplete, false)
      ))
      .orderBy(asc(lotteryDraws.drawDate));
    
    // Filter out weekend draws (Saturday = 6, Sunday = 0)
    const weekdayDailyDraws = allDailyDraws.filter(draw => {
      const drawDay = new Date(draw.drawDate).getDay();
      return drawDay !== 0 && drawDay !== 6; // Exclude Sunday (0) and Saturday (6)
    });
    
    const dailyDraw = weekdayDailyDraws[0] || undefined;

    const [weeklyDraw] = await db.select().from(lotteryDraws)
      .where(and(
        eq(lotteryDraws.type, 'weekly'),
        gte(lotteryDraws.drawDate, now),
        eq(lotteryDraws.isComplete, false)
      ))
      .orderBy(asc(lotteryDraws.drawDate))
      .limit(1);

    return {
      daily: dailyDraw,
      weekly: weeklyDraw
    };
  }

  async updateDrawJackpot(drawId: number, jackpotAmount: string): Promise<LotteryDraw> {
    const [updatedDraw] = await db
      .update(lotteryDraws)
      .set({ jackpotAmount })
      .where(eq(lotteryDraws.id, drawId))
      .returning();
    
    if (!updatedDraw) {
      throw new Error('Draw not found');
    }
    
    return updatedDraw;
  }

  async updateDrawTime(drawId: number, newDrawDate: Date): Promise<LotteryDraw> {
    const [updatedDraw] = await db
      .update(lotteryDraws)
      .set({ drawDate: newDrawDate })
      .where(eq(lotteryDraws.id, drawId))
      .returning();
    
    if (!updatedDraw) {
      throw new Error('Draw not found');
    }
    
    return updatedDraw;
  }

  async deleteDraw(drawId: number): Promise<void> {
    const result = await db
      .delete(lotteryDraws)
      .where(eq(lotteryDraws.id, drawId));
    
    console.log(`Draw ${drawId} deleted from database`);
  }

  async getAllTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }
}

export const storage = new DatabaseStorage();