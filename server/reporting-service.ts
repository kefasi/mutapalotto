import fs from 'fs/promises';
import path from 'path';
import { storage } from './storage';
import type { InsertReportExport } from '@shared/schema';

/**
 * Comprehensive Reporting Service for Regulatory Compliance
 * Generates CSV/Excel reports for accounting and regulatory submissions
 */
export class ReportingService {
  private static instance: ReportingService;
  private readonly reportsDir = './reports';

  private constructor() {
    this.ensureReportsDirectory();
  }

  public static getInstance(): ReportingService {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService();
    }
    return ReportingService.instance;
  }

  /**
   * Ensure reports directory exists
   */
  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  /**
   * Generate daily sales report
   */
  public async generateDailySalesReport(
    date: string,
    format: 'csv' | 'excel',
    userId: number
  ): Promise<{
    reportId: number;
    downloadUrl: string;
    recordCount: number;
    fileSize: string;
  }> {
    const reportType = 'daily_sales';
    const filename = `daily_sales_${date}.${format}`;
    const filePath = path.join(this.reportsDir, filename);

    // Create report export record
    const reportExport = await storage.createReportExport({
      reportType,
      reportPeriod: date,
      fileFormat: format,
      filePath,
      downloadUrl: `/api/reports/download/${filename}`,
      generatedBy: userId,
      parameters: { date },
      status: 'generating',
      recordCount: 0,
      fileSize: '0',
    });

    try {
      // Get sales data for the date
      const salesData = await this.getDailySalesData(date);
      
      // Generate report file
      let content: string;
      if (format === 'csv') {
        content = this.generateSalesCSV(salesData);
      } else {
        content = this.generateSalesExcel(salesData);
      }

      // Write file
      await fs.writeFile(filePath, content);
      const stats = await fs.stat(filePath);

      // Update report record
      await storage.updateReportExport(reportExport.id, {
        status: 'completed',
        recordCount: salesData.length,
        fileSize: this.formatFileSize(stats.size),
        completedAt: new Date(),
      });

      return {
        reportId: reportExport.id,
        downloadUrl: reportExport.downloadUrl!,
        recordCount: salesData.length,
        fileSize: this.formatFileSize(stats.size),
      };

    } catch (error) {
      await storage.updateReportExport(reportExport.id, {
        status: 'failed',
      });
      throw error;
    }
  }

  /**
   * Generate payout approval report
   */
  public async generatePayoutReport(
    startDate: string,
    endDate: string,
    format: 'csv' | 'excel',
    userId: number
  ): Promise<{
    reportId: number;
    downloadUrl: string;
    recordCount: number;
    fileSize: string;
  }> {
    const reportType = 'payouts';
    const filename = `payouts_${startDate}_to_${endDate}.${format}`;
    const filePath = path.join(this.reportsDir, filename);

    const reportExport = await storage.createReportExport({
      reportType,
      reportPeriod: `${startDate}_to_${endDate}`,
      fileFormat: format,
      filePath,
      downloadUrl: `/api/reports/download/${filename}`,
      generatedBy: userId,
      parameters: { startDate, endDate },
      status: 'generating',
      recordCount: 0,
      fileSize: '0',
    });

    try {
      const payoutData = await this.getPayoutData(startDate, endDate);
      
      let content: string;
      if (format === 'csv') {
        content = this.generatePayoutCSV(payoutData);
      } else {
        content = this.generatePayoutExcel(payoutData);
      }

      await fs.writeFile(filePath, content);
      const stats = await fs.stat(filePath);

      await storage.updateReportExport(reportExport.id, {
        status: 'completed',
        recordCount: payoutData.length,
        fileSize: this.formatFileSize(stats.size),
        completedAt: new Date(),
      });

      return {
        reportId: reportExport.id,
        downloadUrl: reportExport.downloadUrl!,
        recordCount: payoutData.length,
        fileSize: this.formatFileSize(stats.size),
      };

    } catch (error) {
      await storage.updateReportExport(reportExport.id, {
        status: 'failed',
      });
      throw error;
    }
  }

  /**
   * Generate agent commission report
   */
  public async generateCommissionReport(
    startDate: string,
    endDate: string,
    format: 'csv' | 'excel',
    userId: number
  ): Promise<{
    reportId: number;
    downloadUrl: string;
    recordCount: number;
    fileSize: string;
  }> {
    const reportType = 'commissions';
    const filename = `agent_commissions_${startDate}_to_${endDate}.${format}`;
    const filePath = path.join(this.reportsDir, filename);

    const reportExport = await storage.createReportExport({
      reportType,
      reportPeriod: `${startDate}_to_${endDate}`,
      fileFormat: format,
      filePath,
      downloadUrl: `/api/reports/download/${filename}`,
      generatedBy: userId,
      parameters: { startDate, endDate },
      status: 'generating',
      recordCount: 0,
      fileSize: '0',
    });

    try {
      const commissionData = await this.getCommissionData(startDate, endDate);
      
      let content: string;
      if (format === 'csv') {
        content = this.generateCommissionCSV(commissionData);
      } else {
        content = this.generateCommissionExcel(commissionData);
      }

      await fs.writeFile(filePath, content);
      const stats = await fs.stat(filePath);

      await storage.updateReportExport(reportExport.id, {
        status: 'completed',
        recordCount: commissionData.length,
        fileSize: this.formatFileSize(stats.size),
        completedAt: new Date(),
      });

      return {
        reportId: reportExport.id,
        downloadUrl: reportExport.downloadUrl!,
        recordCount: commissionData.length,
        fileSize: this.formatFileSize(stats.size),
      };

    } catch (error) {
      await storage.updateReportExport(reportExport.id, {
        status: 'failed',
      });
      throw error;
    }
  }

  /**
   * Generate regulatory compliance report
   */
  public async generateRegulatoryReport(
    quarter: string,
    year: string,
    format: 'csv' | 'excel',
    userId: number
  ): Promise<{
    reportId: number;
    downloadUrl: string;
    recordCount: number;
    fileSize: string;
  }> {
    const reportType = 'regulatory';
    const filename = `regulatory_Q${quarter}_${year}.${format}`;
    const filePath = path.join(this.reportsDir, filename);

    const reportExport = await storage.createReportExport({
      reportType,
      reportPeriod: `Q${quarter}_${year}`,
      fileFormat: format,
      filePath,
      downloadUrl: `/api/reports/download/${filename}`,
      generatedBy: userId,
      parameters: { quarter, year },
      status: 'generating',
      recordCount: 0,
      fileSize: '0',
    });

    try {
      const regulatoryData = await this.getRegulatoryData(quarter, year);
      
      let content: string;
      if (format === 'csv') {
        content = this.generateRegulatoryCSV(regulatoryData);
      } else {
        content = this.generateRegulatoryExcel(regulatoryData);
      }

      await fs.writeFile(filePath, content);
      const stats = await fs.stat(filePath);

      await storage.updateReportExport(reportExport.id, {
        status: 'completed',
        recordCount: regulatoryData.totalTickets,
        fileSize: this.formatFileSize(stats.size),
        completedAt: new Date(),
      });

      return {
        reportId: reportExport.id,
        downloadUrl: reportExport.downloadUrl!,
        recordCount: regulatoryData.totalTickets,
        fileSize: this.formatFileSize(stats.size),
      };

    } catch (error) {
      await storage.updateReportExport(reportExport.id, {
        status: 'failed',
      });
      throw error;
    }
  }

  /**
   * Get daily sales data
   */
  private async getDailySalesData(date: string): Promise<any[]> {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    return await storage.getSalesDataByDateRange(startDate, endDate);
  }

  /**
   * Get payout data
   */
  private async getPayoutData(startDate: string, endDate: string): Promise<any[]> {
    return await storage.getPayoutDataByDateRange(new Date(startDate), new Date(endDate));
  }

  /**
   * Get commission data
   */
  private async getCommissionData(startDate: string, endDate: string): Promise<any[]> {
    return await storage.getCommissionDataByDateRange(new Date(startDate), new Date(endDate));
  }

  /**
   * Get regulatory data
   */
  private async getRegulatoryData(quarter: string, year: string): Promise<any> {
    const quarterStart = this.getQuarterStart(parseInt(quarter), parseInt(year));
    const quarterEnd = this.getQuarterEnd(parseInt(quarter), parseInt(year));

    const [tickets, draws, payouts, agents] = await Promise.all([
      storage.getTicketsByDateRange(quarterStart, quarterEnd),
      storage.getDrawsByDateRange(quarterStart, quarterEnd),
      storage.getPayoutsByDateRange(quarterStart, quarterEnd),
      storage.getAgentDataByDateRange(quarterStart, quarterEnd),
    ]);

    return {
      period: `Q${quarter} ${year}`,
      totalTickets: tickets.length,
      totalSales: tickets.reduce((sum, t) => sum + parseFloat(t.cost), 0),
      totalDraws: draws.length,
      totalPayouts: payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalAgents: agents.length,
      tickets,
      draws,
      payouts,
      agents,
    };
  }

  /**
   * Generate sales CSV content
   */
  private generateSalesCSV(data: any[]): string {
    const headers = [
      'Date',
      'Ticket ID',
      'Customer Phone',
      'Draw Type',
      'Numbers',
      'Cost',
      'Agent ID',
      'Payment Method',
      'Status'
    ];

    const rows = data.map(item => [
      item.createdAt.toISOString().split('T')[0],
      item.id,
      item.customerPhone || 'N/A',
      item.drawType,
      item.selectedNumbers.join(', '),
      item.cost,
      item.agentId || 'Direct',
      item.paymentMethod || 'Unknown',
      item.status || 'Completed'
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Generate payout CSV content
   */
  private generatePayoutCSV(data: any[]): string {
    const headers = [
      'Date',
      'Ticket ID',
      'Customer Phone',
      'Prize Amount',
      'Draw Type',
      'Winning Numbers',
      'Matched Numbers',
      'Status',
      'Payment Method',
      'Payment Reference'
    ];

    const rows = data.map(item => [
      item.createdAt.toISOString().split('T')[0],
      item.ticketId,
      item.customerPhone,
      item.prizeAmount,
      item.drawType,
      item.winningNumbers.join(', '),
      item.matchedNumbers,
      item.status,
      item.paymentMethod || 'Wallet',
      item.paymentReference || 'N/A'
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Generate commission CSV content
   */
  private generateCommissionCSV(data: any[]): string {
    const headers = [
      'Date',
      'Agent ID',
      'Agent Name',
      'Agent Code',
      'Commission Amount',
      'Sales Count',
      'Total Sales',
      'Commission Rate',
      'Status',
      'Payment Reference'
    ];

    const rows = data.map(item => [
      item.createdAt.toISOString().split('T')[0],
      item.agentId,
      item.agentName,
      item.agentCode,
      item.commission,
      item.salesCount || 1,
      item.totalSales || item.commission * 20, // Estimated from 5% commission
      '5%',
      item.status || 'Pending',
      item.paymentReference || 'N/A'
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  /**
   * Generate regulatory CSV content
   */
  private generateRegulatoryCSV(data: any): string {
    const summaryHeaders = [
      'Period',
      'Total Tickets Sold',
      'Total Sales Revenue',
      'Total Draws Conducted',
      'Total Payouts',
      'Total Active Agents',
      'Revenue Retention Rate'
    ];

    const retentionRate = ((data.totalSales - data.totalPayouts) / data.totalSales * 100).toFixed(2);

    const summaryRow = [
      data.period,
      data.totalTickets,
      `$${data.totalSales.toFixed(2)}`,
      data.totalDraws,
      `$${data.totalPayouts.toFixed(2)}`,
      data.totalAgents,
      `${retentionRate}%`
    ];

    return this.arrayToCSV([summaryHeaders, summaryRow]);
  }

  /**
   * Generate Excel content (simplified CSV format for now)
   */
  private generateSalesExcel(data: any[]): string {
    return this.generateSalesCSV(data);
  }

  private generatePayoutExcel(data: any[]): string {
    return this.generatePayoutCSV(data);
  }

  private generateCommissionExcel(data: any[]): string {
    return this.generateCommissionCSV(data);
  }

  private generateRegulatoryExcel(data: any): string {
    return this.generateRegulatoryCSV(data);
  }

  /**
   * Convert array to CSV string
   */
  private arrayToCSV(data: any[][]): string {
    return data
      .map(row =>
        row
          .map(field => {
            if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          })
          .join(',')
      )
      .join('\n');
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get quarter start date
   */
  private getQuarterStart(quarter: number, year: number): Date {
    const month = (quarter - 1) * 3;
    return new Date(year, month, 1);
  }

  /**
   * Get quarter end date
   */
  private getQuarterEnd(quarter: number, year: number): Date {
    const month = quarter * 3;
    return new Date(year, month, 0);
  }

  /**
   * Get available reports
   */
  public async getAvailableReports(userId?: number): Promise<any[]> {
    return await storage.getReportExports(userId);
  }

  /**
   * Get report file content for download
   */
  public async getReportFile(filename: string): Promise<Buffer> {
    const filePath = path.join(this.reportsDir, filename);
    return await fs.readFile(filePath);
  }
}

export const reportingService = ReportingService.getInstance();