import { storage } from './storage';
import crypto from 'crypto';

/**
 * Digital Receipt Service for Agent Portal
 * Generates printable and SMS ticket receipts with QR codes
 */
export class ReceiptService {
  private static instance: ReceiptService;

  private constructor() {}

  public static getInstance(): ReceiptService {
    if (!ReceiptService.instance) {
      ReceiptService.instance = new ReceiptService();
    }
    return ReceiptService.instance;
  }

  /**
   * Generate digital ticket receipt for agent sales
   */
  public async generateTicketReceipt(ticketId: number, agentId: number): Promise<{
    receiptId: string;
    receiptData: any;
    printableHtml: string;
    smsText: string;
  }> {
    try {
      const ticket = await storage.getTicketById(ticketId);
      const agent = await storage.getUserById(agentId);
      
      if (!ticket || !agent) {
        throw new Error('Ticket or agent not found');
      }

      const receiptId = this.generateReceiptId();
      const timestamp = new Date();

      // Generate verification QR code data
      const qrData = {
        ticketId: ticket.id,
        receiptId,
        agentId,
        timestamp: timestamp.toISOString(),
        hash: this.generateReceiptHash(ticket.id, receiptId, agentId)
      };

      const receiptData = {
        receiptId,
        timestamp,
        ticket: {
          id: ticket.id,
          numbers: ticket.numbers,
          drawType: ticket.drawType,
          drawDate: ticket.drawDate,
          cost: ticket.cost,
        },
        agent: {
          id: agent.id,
          name: `${agent.firstName} ${agent.lastName}`.trim() || agent.phoneNumber,
          agentCode: agent.agentCode,
          location: agent.location || 'N/A',
        },
        customer: {
          phoneNumber: ticket.customerPhone || 'Walk-in Customer',
        },
        verification: qrData,
      };

      // Generate printable HTML receipt
      const printableHtml = this.generatePrintableReceipt(receiptData);

      // Generate SMS text receipt
      const smsText = this.generateSMSReceipt(receiptData);

      // Store receipt in database for audit trail
      await storage.createTicketReceipt({
        receiptId,
        ticketId: ticket.id,
        agentId,
        receiptData: JSON.stringify(receiptData),
        generatedAt: timestamp,
      });

      return {
        receiptId,
        receiptData,
        printableHtml,
        smsText,
      };

    } catch (error) {
      console.error('Error generating ticket receipt:', error);
      throw new Error('Failed to generate receipt');
    }
  }

  /**
   * Generate weekly sales summary for agent
   */
  public async generateWeeklySummary(agentId: number, weekStart: Date): Promise<{
    summaryId: string;
    summaryData: any;
    printableHtml: string;
  }> {
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const agent = await storage.getUserById(agentId);
      const tickets = await storage.getAgentTicketsByDateRange(agentId, weekStart, weekEnd);
      const commissions = await storage.getAgentCommissionsByDateRange(agentId, weekStart, weekEnd);

      const summaryId = this.generateSummaryId();
      
      const summaryData = {
        summaryId,
        agent: {
          id: agent?.id,
          name: `${agent?.firstName} ${agent?.lastName}`.trim() || agent?.phoneNumber,
          agentCode: agent?.agentCode,
        },
        period: {
          start: weekStart,
          end: weekEnd,
        },
        sales: {
          totalTickets: tickets.length,
          totalRevenue: tickets.reduce((sum, ticket) => sum + parseFloat(ticket.cost), 0),
          dailyTickets: tickets.filter(t => t.drawType === 'daily').length,
          weeklyTickets: tickets.filter(t => t.drawType === 'weekly').length,
        },
        commissions: {
          totalCommission: commissions.reduce((sum, comm) => sum + parseFloat(comm.amount), 0),
          paidCommissions: commissions.filter(c => c.status === 'paid').length,
          pendingCommissions: commissions.filter(c => c.status === 'pending').length,
        },
        performance: {
          averageDaily: tickets.length / 7,
          topDay: this.getTopSalesDay(tickets),
        }
      };

      const printableHtml = this.generateWeeklySummaryHtml(summaryData);

      // Store summary for records
      await storage.createWeeklySummary({
        summaryId,
        agentId,
        weekStart,
        weekEnd,
        summaryData: JSON.stringify(summaryData),
        generatedAt: new Date(),
      });

      return {
        summaryId,
        summaryData,
        printableHtml,
      };

    } catch (error) {
      console.error('Error generating weekly summary:', error);
      throw new Error('Failed to generate weekly summary');
    }
  }

  /**
   * Generate printable HTML receipt
   */
  private generatePrintableReceipt(receiptData: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Mutapa Lottery Ticket Receipt</title>
    <style>
        body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 10px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .logo { font-size: 18px; font-weight: bold; color: #2d5016; }
        .ticket-info { margin: 10px 0; }
        .numbers { font-size: 16px; font-weight: bold; text-align: center; padding: 10px; border: 1px solid #000; }
        .footer { border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; font-size: 11px; }
        .qr-code { text-align: center; margin: 10px 0; }
        @media print { body { max-width: none; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏛️ MUTAPA LOTTERY</div>
        <div>Official Ticket Receipt</div>
        <div>Receipt #: ${receiptData.receiptId}</div>
    </div>

    <div class="ticket-info">
        <strong>Ticket ID:</strong> ${receiptData.ticket.id}<br>
        <strong>Draw:</strong> ${receiptData.ticket.drawType.toUpperCase()}<br>
        <strong>Draw Date:</strong> ${new Date(receiptData.ticket.drawDate).toLocaleDateString()}<br>
        <strong>Cost:</strong> $${receiptData.ticket.cost}<br>
        <strong>Issued:</strong> ${new Date(receiptData.timestamp).toLocaleString()}
    </div>

    <div class="numbers">
        Your Numbers: ${receiptData.ticket.numbers.join(' - ')}
    </div>

    <div class="ticket-info">
        <strong>Agent:</strong> ${receiptData.agent.name}<br>
        <strong>Agent Code:</strong> ${receiptData.agent.agentCode}<br>
        <strong>Location:</strong> ${receiptData.agent.location}<br>
        <strong>Customer:</strong> ${receiptData.customer.phoneNumber}
    </div>

    <div class="qr-code">
        <div>Scan to verify ticket authenticity</div>
        <div style="font-size: 10px; margin-top: 5px;">QR: ${receiptData.verification.hash.substring(0, 16)}...</div>
    </div>

    <div class="footer">
        <div><strong>Keep this receipt safe!</strong></div>
        <div>Check results at mutapalottery.com</div>
        <div>Winner must present this receipt</div>
        <div>Prizes must be claimed within 90 days</div>
        <div style="margin-top: 10px; text-align: center;">
            🇿🇼 Good Luck! 🇿🇼
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate SMS text receipt
   */
  private generateSMSReceipt(receiptData: any): string {
    return `🏛️ MUTAPA LOTTERY RECEIPT

Ticket: ${receiptData.ticket.id}
Numbers: ${receiptData.ticket.numbers.join('-')}
Draw: ${receiptData.ticket.drawType.toUpperCase()}
Date: ${new Date(receiptData.ticket.drawDate).toLocaleDateString()}
Cost: $${receiptData.ticket.cost}

Agent: ${receiptData.agent.name}
Receipt: ${receiptData.receiptId}

Keep this SMS! Check results at mutapalottery.com
Good luck! 🇿🇼`;
  }

  /**
   * Generate weekly summary HTML
   */
  private generateWeeklySummaryHtml(summaryData: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Weekly Sales Summary - ${summaryData.agent.name}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #2d5016; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #2d5016; margin-bottom: 10px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .summary-card h3 { margin-top: 0; color: #2d5016; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .metric-value { font-weight: bold; color: #c6a962; }
        @media print { .summary-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏛️ MUTAPA LOTTERY</div>
        <h2>Weekly Sales Summary</h2>
        <div><strong>Agent:</strong> ${summaryData.agent.name} (${summaryData.agent.agentCode})</div>
        <div><strong>Period:</strong> ${new Date(summaryData.period.start).toLocaleDateString()} - ${new Date(summaryData.period.end).toLocaleDateString()}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>Sales Performance</h3>
            <div class="metric">
                <span>Total Tickets Sold:</span>
                <span class="metric-value">${summaryData.sales.totalTickets}</span>
            </div>
            <div class="metric">
                <span>Total Revenue:</span>
                <span class="metric-value">$${summaryData.sales.totalRevenue.toFixed(2)}</span>
            </div>
            <div class="metric">
                <span>Daily Tickets:</span>
                <span class="metric-value">${summaryData.sales.dailyTickets}</span>
            </div>
            <div class="metric">
                <span>Weekly Tickets:</span>
                <span class="metric-value">${summaryData.sales.weeklyTickets}</span>
            </div>
        </div>

        <div class="summary-card">
            <h3>Commission Summary</h3>
            <div class="metric">
                <span>Total Commission:</span>
                <span class="metric-value">$${summaryData.commissions.totalCommission.toFixed(2)}</span>
            </div>
            <div class="metric">
                <span>Paid Commissions:</span>
                <span class="metric-value">${summaryData.commissions.paidCommissions}</span>
            </div>
            <div class="metric">
                <span>Pending Commissions:</span>
                <span class="metric-value">${summaryData.commissions.pendingCommissions}</span>
            </div>
        </div>
    </div>

    <div class="summary-card">
        <h3>Performance Metrics</h3>
        <div class="metric">
            <span>Average Daily Sales:</span>
            <span class="metric-value">${summaryData.performance.averageDaily.toFixed(1)} tickets</span>
        </div>
        <div class="metric">
            <span>Best Sales Day:</span>
            <span class="metric-value">${summaryData.performance.topDay}</span>
        </div>
    </div>

    <div style="margin-top: 30px; text-align: center; color: #666;">
        <p>This summary is automatically generated for your records.</p>
        <p>For questions, contact Mutapa Lottery support.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate unique receipt ID
   */
  private generateReceiptId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `RC-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Generate unique summary ID
   */
  private generateSummaryId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `WS-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Generate receipt hash for verification
   */
  private generateReceiptHash(ticketId: number, receiptId: string, agentId: number): string {
    const data = `${ticketId}-${receiptId}-${agentId}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get top sales day from tickets
   */
  private getTopSalesDay(tickets: any[]): string {
    const dayCount: { [key: string]: number } = {};
    
    tickets.forEach(ticket => {
      const day = new Date(ticket.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    const topDay = Object.entries(dayCount).sort(([,a], [,b]) => b - a)[0];
    return topDay ? `${topDay[0]} (${topDay[1]} tickets)` : 'No sales';
  }

  /**
   * Verify receipt authenticity
   */
  public async verifyReceipt(receiptId: string): Promise<{
    isValid: boolean;
    receiptData?: any;
    error?: string;
  }> {
    try {
      const receipt = await storage.getTicketReceipt(receiptId);
      
      if (!receipt) {
        return { isValid: false, error: 'Receipt not found' };
      }

      return {
        isValid: true,
        receiptData: JSON.parse(receipt.receiptData),
      };

    } catch (error) {
      return { isValid: false, error: 'Verification failed' };
    }
  }
}

export const receiptService = ReceiptService.getInstance();