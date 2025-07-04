import { pgTable, text, varchar, serial, integer, boolean, timestamp, decimal, json, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  surname: text("surname").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isAgent: boolean("is_agent").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  kycVerified: boolean("kyc_verified").notNull().default(false),
  isFrozen: boolean("is_frozen").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  passwordHash: text("password_hash"),
  agentCode: text("agent_code").unique(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }).default("0.05"),
  lastVerificationReminder: timestamp("last_verification_reminder"),
  verificationReminderCount: integer("verification_reminder_count").notNull().default(0),
  registrationMethod: text("registration_method").notNull().default("web"), // 'web', 'ussd', 'agent'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  documentType: text("document_type").notNull(), // 'id_upload', 'screen_capture', 'national_id_api'
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  nationalId: text("national_id"), // National ID number for API verification
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'failed'
  verificationMethod: text("verification_method").notNull().default("manual"), // 'manual', 'api', 'hybrid'
  apiResponse: json("api_response"), // Store API verification response
  failureReason: text("failure_reason"), // Reason for failure
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

export const vrfSeeds = pgTable("vrf_seeds", {
  id: serial("id").primaryKey(),
  drawId: integer("draw_id").notNull(),
  seedValue: text("seed_value").notNull(),
  publicKey: text("public_key").notNull(),
  proof: text("proof").notNull(),
  output: text("output").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lotteryDraws = pgTable("lottery_draws", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'daily' or 'weekly'
  drawDate: timestamp("draw_date").notNull(),
  winningNumbers: json("winning_numbers").$type<number[]>().notNull(),
  jackpotAmount: decimal("jackpot_amount", { precision: 10, scale: 2 }).notNull(),
  totalTickets: integer("total_tickets").notNull().default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  blockchainHash: text("blockchain_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  drawId: integer("draw_id").notNull(),
  ticketNumber: text("ticket_number").notNull().unique(),
  selectedNumbers: json("selected_numbers").$type<number[]>().notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  matchedNumbers: integer("matched_numbers").default(0),
  prizeAmount: decimal("prize_amount", { precision: 10, scale: 2 }).default("0.00"),
  isWinner: boolean("is_winner").notNull().default(false),
  agentId: integer("agent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // 'deposit', 'ticket_purchase', 'prize_payout'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  paymentMethod: text("payment_method"), // 'ecocash', 'wallet'
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'failed'
  ecocashReference: text("ecocash_reference"), // EcoCash transaction reference
  failureReason: text("failure_reason"), // Reason for failed transactions
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentSales = pgTable("agent_sales", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  ticketId: integer("ticket_id").notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentCommissions = pgTable("agent_commissions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalCommission: decimal("total_commission", { precision: 10, scale: 2 }).notNull().default("0.00"),
  ticketsSold: integer("tickets_sold").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending, paid, cancelled
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"), // ecocash, bank_transfer, cash
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentPayments = pgTable("agent_payments", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  commissionId: integer("commission_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentReference: text("payment_reference"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  processedAt: timestamp("processed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentTargets = pgTable("agent_targets", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  targetPeriod: text("target_period").notNull(), // weekly, monthly, quarterly
  salesTarget: decimal("sales_target", { precision: 10, scale: 2 }).notNull(),
  ticketsTarget: integer("tickets_target").notNull(),
  bonusRate: decimal("bonus_rate", { precision: 5, scale: 4 }).default("0.00"), // additional commission for hitting target
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  achieved: boolean("achieved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertLotteryDrawSchema = createInsertSchema(lotteryDraws).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  ticketNumber: true,
  matchedNumbers: true,
  prizeAmount: true,
  isWinner: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertAgentSaleSchema = createInsertSchema(agentSales).omit({
  id: true,
  createdAt: true,
});

export const insertAgentCommissionSchema = createInsertSchema(agentCommissions).omit({
  id: true,
  createdAt: true,
  paidAt: true,
});

export const insertAgentPaymentSchema = createInsertSchema(agentPayments).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertAgentTargetSchema = createInsertSchema(agentTargets).omit({
  id: true,
  createdAt: true,
});

export const insertKycDocumentSchema = createInsertSchema(kycDocuments).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
});

export const insertVrfSeedSchema = createInsertSchema(vrfSeeds).omit({
  id: true,
  createdAt: true,
});

// Payout Approval System
export const payoutApprovals = pgTable("payout_approvals", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  prizeAmount: text("prize_amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, paid
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paymentMethod: text("payment_method"), // wallet, ecocash, bank_transfer
  paymentReference: text("payment_reference"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
});

// Draw Control System
export const drawControls = pgTable("draw_controls", {
  id: serial("id").primaryKey(),
  drawType: text("draw_type").notNull(), // daily, weekly
  isHalted: boolean("is_halted").default(false),
  haltReason: text("halt_reason"),
  haltedBy: integer("halted_by").references(() => users.id),
  haltedAt: timestamp("halted_at"),
  resumedBy: integer("resumed_by").references(() => users.id),
  resumedAt: timestamp("resumed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cryptographic Ticket Hashing
export const ticketHashes = pgTable("ticket_hashes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  ticketHash: text("ticket_hash").notNull().unique(),
  merkleRoot: text("merkle_root"),
  blockchainTxHash: text("blockchain_tx_hash"),
  hashAlgorithm: text("hash_algorithm").default("SHA-256"),
  createdAt: timestamp("created_at").defaultNow(),
});

// On-chain RNG Audit Trail
export const rngAuditLog = pgTable("rng_audit_log", {
  id: serial("id").primaryKey(),
  drawId: integer("draw_id").references(() => lotteryDraws.id).notNull(),
  requestId: text("request_id").notNull(), // Chainlink VRF request ID
  randomSeed: text("random_seed").notNull(),
  vrfProof: text("vrf_proof"),
  publicKey: text("public_key"),
  blockNumber: integer("block_number"),
  transactionHash: text("transaction_hash"),
  gasUsed: text("gas_used"),
  oracleAddress: text("oracle_address"),
  verificationStatus: text("verification_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Interface for Verification
export const auditVerifications = pgTable("audit_verifications", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id),
  drawId: integer("draw_id").references(() => lotteryDraws.id),
  verificationHash: text("verification_hash").notNull(),
  verificationResult: json("verification_result"), // stores detailed verification data
  verifierAddress: text("verifier_address"), // Who performed verification
  verifiedAt: timestamp("verified_at").defaultNow(),
});

// Blockchain Blocks - Database Storage
export const blockchainBlocks = pgTable("blockchain_blocks", {
  id: serial("id").primaryKey(),
  blockIndex: integer("block_index").notNull().unique(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  previousHash: text("previous_hash").notNull(),
  merkleRoot: text("merkle_root").notNull(),
  hash: text("hash").notNull().unique(),
  nonce: integer("nonce").notNull(),
  difficulty: integer("difficulty").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Blockchain Transactions - Database Storage  
export const blockchainTransactions = pgTable("blockchain_transactions", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull().unique(),
  blockId: integer("block_id").references(() => blockchainBlocks.id).notNull(),
  drawId: integer("draw_id").references(() => lotteryDraws.id).notNull(),
  drawType: text("draw_type").notNull(), // daily, weekly
  winningNumbers: json("winning_numbers").notNull(),
  vrfProof: text("vrf_proof").notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  previousHash: text("previous_hash").notNull(),
  hash: text("hash").notNull(),
  merkleRoot: text("merkle_root").notNull(),
  participantCount: integer("participant_count").notNull(),
  totalStake: text("total_stake").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reporting and Export System
export const reportExports = pgTable("report_exports", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(), // daily_sales, payouts, commissions, regulatory
  reportPeriod: text("report_period").notNull(), // YYYY-MM-DD format
  fileFormat: text("file_format").notNull(), // csv, excel
  filePath: text("file_path"),
  downloadUrl: text("download_url"),
  generatedBy: integer("generated_by").references(() => users.id).notNull(),
  parameters: json("parameters"), // store report generation parameters
  status: text("status").default("generating"), // generating, completed, failed
  recordCount: integer("record_count"),
  fileSize: text("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// System settings for persistent configuration
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  settingType: text("setting_type").notNull(), // 'string', 'number', 'boolean', 'json'
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"), // admin who made the change
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

// Zimbabwean phone number validation
const validateZimbabweanPhone = (phone: string): boolean => {
  // Remove any spaces, dashes, or other non-numeric characters except +
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // Zimbabwe phone number patterns:
  // Mobile: 263771234567, 263781234567, 263731234567 (with country code)
  // Mobile: 0771234567, 0781234567, 0731234567 (local format)
  // Landline: 2634123456 (with country code), 04123456 (local format)
  
  // Check for international format (+263 or 263)
  if (cleanPhone.startsWith('+263') || cleanPhone.startsWith('263')) {
    const number = cleanPhone.replace(/^\+?263/, '');
    // Mobile networks: 77, 78, 73, 71, 74 (9 digits after network code)
    if (/^(77|78|73|71|74)\d{7}$/.test(number)) {
      return true;
    }
    // Landlines: 4, 8, 9 (6-7 digits after area code)
    if (/^(4|8|9)\d{6,7}$/.test(number)) {
      return true;
    }
  }
  
  // Check for local format (starting with 0)
  if (cleanPhone.startsWith('0')) {
    // Mobile: 077, 078, 073, 071, 074 (7 digits after)
    if (/^0(77|78|73|71|74)\d{7}$/.test(cleanPhone)) {
      return true;
    }
    // Landlines: 04, 08, 09 (6-7 digits after)
    if (/^0(4|8|9)\d{6,7}$/.test(cleanPhone)) {
      return true;
    }
  }
  
  return false;
};

// Auth schemas
export const loginSchema = z.object({
  phone: z.string()
    .min(9, "Phone number is required")
    .refine(validateZimbabweanPhone, {
      message: "Please enter a valid Zimbabwean phone number (e.g., 0771234567, +263771234567)"
    }),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  phone: z.string()
    .min(9, "Phone number is required")
    .refine(validateZimbabweanPhone, {
      message: "Please enter a valid Zimbabwean phone number (e.g., 0771234567, +263771234567)"
    }),
  name: z.string().min(2, "First name is required"),
  surname: z.string().min(2, "Surname is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isAgent: z.boolean().default(false),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type LotteryDraw = typeof lotteryDraws.$inferSelect;
export type InsertLotteryDraw = z.infer<typeof insertLotteryDrawSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type AgentSale = typeof agentSales.$inferSelect;
export type InsertAgentSale = z.infer<typeof insertAgentSaleSchema>;

export type AgentCommission = typeof agentCommissions.$inferSelect;
export type InsertAgentCommission = z.infer<typeof insertAgentCommissionSchema>;

export type AgentPayment = typeof agentPayments.$inferSelect;
export type InsertAgentPayment = z.infer<typeof insertAgentPaymentSchema>;

export type AgentTarget = typeof agentTargets.$inferSelect;
export type InsertAgentTarget = z.infer<typeof insertAgentTargetSchema>;

export type KycDocument = typeof kycDocuments.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;

export type VrfSeed = typeof vrfSeeds.$inferSelect;
export type InsertVrfSeed = z.infer<typeof insertVrfSeedSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// New Security and Regulatory Types
export type PayoutApproval = typeof payoutApprovals.$inferSelect;
export type InsertPayoutApproval = typeof payoutApprovals.$inferInsert;

export type DrawControl = typeof drawControls.$inferSelect;
export type InsertDrawControl = typeof drawControls.$inferInsert;

export type TicketHash = typeof ticketHashes.$inferSelect;
export type InsertTicketHash = typeof ticketHashes.$inferInsert;

export type RngAuditLog = typeof rngAuditLog.$inferSelect;
export type InsertRngAuditLog = typeof rngAuditLog.$inferInsert;

export type AuditVerification = typeof auditVerifications.$inferSelect;
export type InsertAuditVerification = typeof auditVerifications.$inferInsert;

export type BlockchainBlock = typeof blockchainBlocks.$inferSelect;
export type InsertBlockchainBlock = typeof blockchainBlocks.$inferInsert;

export type BlockchainTransaction = typeof blockchainTransactions.$inferSelect;
export type InsertBlockchainTransaction = typeof blockchainTransactions.$inferInsert;

export type ReportExport = typeof reportExports.$inferSelect;
export type InsertReportExport = typeof reportExports.$inferInsert;

// Community Stories for Financial Inclusion - Admin managed content
export const communityStories = pgTable("community_stories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleShona: text("title_shona"), // Shona translation
  content: text("content").notNull(),
  contentShona: text("content_shona"), // Shona translation
  imageUrl: text("image_url"),
  impactAmount: decimal("impact_amount", { precision: 12, scale: 2 }), // Revenue injected
  communityLocation: text("community_location").notNull(),
  status: text("status").notNull().default("draft"), // draft, published, archived
  featured: boolean("featured").default(false),
  viewCount: integer("view_count").default(0),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// FAQ System with Bilingual Support
export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  questionShona: text("question_shona"), // Shona translation
  answer: text("answer").notNull(),
  answerShona: text("answer_shona"), // Shona translation
  category: text("category").notNull(), // 'general', 'payments', 'tickets', 'agent', 'technical'
  priority: integer("priority").default(0), // Higher number = higher priority
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support Tickets for Customer and Technical Issues
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  userPhone: text("user_phone"), // For non-registered users
  userName: text("user_name"),
  category: text("category").notNull(), // 'technical', 'payment', 'account', 'general', 'urgent'
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  language: text("language").default("en"), // 'en' or 'sn' (Shona)
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: text("status").default("open"), // 'open', 'in_progress', 'resolved', 'closed'
  assignedTo: integer("assigned_to").references(() => users.id),
  attachments: json("attachments"), // Array of file URLs
  resolutionNotes: text("resolution_notes"),
  satisfactionRating: integer("satisfaction_rating"), // 1-5 stars
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support Ticket Responses/Comments
export const ticketResponses = pgTable("ticket_responses", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id).notNull(),
  responderId: integer("responder_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isPublic: boolean("is_public").default(true), // false for internal notes
  attachments: json("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Database Backup and Disaster Recovery Logs
export const backupLogs = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  backupType: text("backup_type").notNull(), // 'nightly', 'weekly_offsite', 'manual'
  status: text("status").notNull(), // 'started', 'completed', 'failed'
  backupSize: text("backup_size"), // File size in MB/GB
  backupLocation: text("backup_location"), // Storage location/path
  encryptionStatus: text("encryption_status").default("encrypted"),
  integrityCheck: boolean("integrity_check").default(false),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Disaster Recovery Tests
export const disasterRecoveryTests = pgTable("disaster_recovery_tests", {
  id: serial("id").primaryKey(),
  testType: text("test_type").notNull(), // 'quarterly', 'annual', 'emergency'
  testScenario: text("test_scenario").notNull(),
  status: text("status").notNull(), // 'planned', 'in_progress', 'completed', 'failed'
  conductedBy: integer("conducted_by").references(() => users.id).notNull(),
  results: text("results"),
  recoveryTime: integer("recovery_time"), // Minutes to recovery
  dataLoss: text("data_loss"), // Amount of data lost if any
  improvementNotes: text("improvement_notes"),
  nextTestDate: timestamp("next_test_date"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Notification System for ID Verification and General Notifications
export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'id_verification_reminder', 'draw_result', 'low_balance', 'system_update'
  title: text("title").notNull(),
  message: text("message").notNull(),
  method: text("method").notNull(), // 'sms', 'push', 'email', 'ussd'
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'delivered', 'failed'
  metadata: json("metadata"), // Store additional data (phone, draw_id, etc.)
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas
export const insertCommunityStorySchema = createInsertSchema(communityStories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTicketResponseSchema = createInsertSchema(ticketResponses).omit({
  id: true,
  createdAt: true,
});

export const insertBackupLogSchema = createInsertSchema(backupLogs).omit({
  id: true,
  createdAt: true,
});

export const insertDisasterRecoveryTestSchema = createInsertSchema(disasterRecoveryTests).omit({
  id: true,
  createdAt: true,
});

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});

// Export types
export type CommunityStory = typeof communityStories.$inferSelect;
export type InsertCommunityStory = z.infer<typeof insertCommunityStorySchema>;

export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export type TicketResponse = typeof ticketResponses.$inferSelect;
export type InsertTicketResponse = z.infer<typeof insertTicketResponseSchema>;

export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;

export type DisasterRecoveryTest = typeof disasterRecoveryTests.$inferSelect;
export type InsertDisasterRecoveryTest = z.infer<typeof insertDisasterRecoveryTestSchema>;

export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
