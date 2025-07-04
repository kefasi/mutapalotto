import { storage } from './storage';
import { notificationService } from './notification-service';
import type { LotteryDraw, Ticket, User } from '@shared/schema';

/**
 * Winner Service for Lottery Prize Processing
 * Handles winner selection, prize calculation, and payout distribution
 */
export class WinnerService {
  private static instance: WinnerService;

  private constructor() {}

  public static getInstance(): WinnerService {
    if (!WinnerService.instance) {
      WinnerService.instance = new WinnerService();
    }
    return WinnerService.instance;
  }

  /**
   * Process all winners for a completed draw
   */
  public async processDrawWinners(drawId: number): Promise<{
    totalWinners: number;
    totalPrizeAmount: string;
    winnersByTier: Record<number, number>;
    processedTickets: number;
  }> {
    try {
      const draw = await storage.getLatestDraw(await this.getDrawType(drawId));
      if (!draw || !draw.winningNumbers || draw.winningNumbers.length === 0) {
        throw new Error('Draw not found or no winning numbers available');
      }

      const tickets = await storage.getTicketsByDraw(drawId);
      console.log(`Processing ${tickets.length} tickets for draw ${drawId}`);

      let totalWinners = 0;
      let totalPrizeAmount = 0;
      const winnersByTier: Record<number, number> = {};

      for (const ticket of tickets) {
        const result = await this.processTicketWin(ticket, draw.winningNumbers, draw);
        
        if (result.isWinner) {
          totalWinners++;
          totalPrizeAmount += parseFloat(result.prizeAmount);
          
          const matches = result.matchedNumbers;
          winnersByTier[matches] = (winnersByTier[matches] || 0) + 1;

          // Send winner notification
          await this.notifyWinner(ticket, result.prizeAmount, matches, draw);
        }

        // Update ticket with results
        await storage.updateTicketResults(
          ticket.id, 
          result.matchedNumbers, 
          result.prizeAmount, 
          result.isWinner
        );
      }

      console.log(`Processed ${tickets.length} tickets, found ${totalWinners} winners`);
      
      return {
        totalWinners,
        totalPrizeAmount: totalPrizeAmount.toFixed(2),
        winnersByTier,
        processedTickets: tickets.length
      };

    } catch (error) {
      console.error('Error processing draw winners:', error);
      throw error;
    }
  }

  /**
   * Process individual ticket for winning
   */
  private async processTicketWin(
    ticket: Ticket, 
    winningNumbers: number[], 
    draw: LotteryDraw
  ): Promise<{
    isWinner: boolean;
    matchedNumbers: number;
    prizeAmount: string;
  }> {
    // Calculate matched numbers
    const matches = ticket.selectedNumbers.filter(num => 
      winningNumbers.includes(num)
    ).length;

    // Determine if winner and calculate prize
    const { isWinner, prizeAmount } = this.calculatePrize(matches, draw.type as 'daily' | 'weekly', draw.jackpotAmount);

    // If winner, credit prize to user account
    if (isWinner && parseFloat(prizeAmount) > 0) {
      await this.creditPrizeToUser(ticket.userId, prizeAmount, ticket.ticketNumber);
    }

    return {
      isWinner,
      matchedNumbers: matches,
      prizeAmount
    };
  }

  /**
   * Calculate prize amount based on matches and draw type
   */
  private calculatePrize(matches: number, drawType: 'daily' | 'weekly', jackpotAmount: string): {
    isWinner: boolean;
    prizeAmount: string;
  } {
    const jackpot = parseFloat(jackpotAmount);

    if (drawType === 'daily') {
      // Daily Draw Prize Structure (5 numbers from 1-45)
      switch (matches) {
        case 5: // Jackpot
          return { isWinner: true, prizeAmount: jackpot.toFixed(2) };
        case 4: // Second Prize
          return { isWinner: true, prizeAmount: (jackpot * 0.15).toFixed(2) };
        case 3: // Third Prize
          return { isWinner: true, prizeAmount: (jackpot * 0.05).toFixed(2) };
        case 2: // Fourth Prize
          return { isWinner: true, prizeAmount: "10.00" };
        default:
          return { isWinner: false, prizeAmount: "0.00" };
      }
    } else {
      // Weekly Draw Prize Structure (6 numbers from 1-49)
      switch (matches) {
        case 6: // Jackpot
          return { isWinner: true, prizeAmount: jackpot.toFixed(2) };
        case 5: // Second Prize
          return { isWinner: true, prizeAmount: (jackpot * 0.20).toFixed(2) };
        case 4: // Third Prize
          return { isWinner: true, prizeAmount: (jackpot * 0.10).toFixed(2) };
        case 3: // Fourth Prize
          return { isWinner: true, prizeAmount: (jackpot * 0.03).toFixed(2) };
        case 2: // Fifth Prize
          return { isWinner: true, prizeAmount: "25.00" };
        default:
          return { isWinner: false, prizeAmount: "0.00" };
      }
    }
  }

  /**
   * Credit prize amount to user's wallet
   */
  private async creditPrizeToUser(userId: number, prizeAmount: string, ticketNumber: string): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        console.error(`User ${userId} not found for prize credit`);
        return;
      }

      // Update user balance
      const currentBalance = parseFloat(user.balance);
      const prizeValue = parseFloat(prizeAmount);
      const newBalance = (currentBalance + prizeValue).toFixed(2);
      
      await storage.updateUserBalance(userId, newBalance);

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: "prize_payout",
        amount: prizeAmount,
        description: `Lottery prize for ticket ${ticketNumber}`,
        paymentMethod: "wallet",
        status: "completed",
      });

      console.log(`Credited $${prizeAmount} to user ${userId} for ticket ${ticketNumber}`);
      
    } catch (error) {
      console.error(`Error crediting prize to user ${userId}:`, error);
    }
  }

  /**
   * Send winner notification
   */
  private async notifyWinner(
    ticket: Ticket, 
    prizeAmount: string, 
    matches: number, 
    draw: LotteryDraw
  ): Promise<void> {
    try {
      const user = await storage.getUser(ticket.userId);
      if (!user) return;

      const prizeValue = parseFloat(prizeAmount);
      let prizeTitle = "";
      
      if (draw.type === 'daily') {
        switch (matches) {
          case 5: prizeTitle = "JACKPOT WINNER"; break;
          case 4: prizeTitle = "Second Prize"; break;
          case 3: prizeTitle = "Third Prize"; break;
          case 2: prizeTitle = "Fourth Prize"; break;
        }
      } else {
        switch (matches) {
          case 6: prizeTitle = "JACKPOT WINNER"; break;
          case 5: prizeTitle = "Second Prize"; break;
          case 4: prizeTitle = "Third Prize"; break;
          case 3: prizeTitle = "Fourth Prize"; break;
          case 2: prizeTitle = "Fifth Prize"; break;
        }
      }

      const message = `🎉 CONGRATULATIONS! You are a ${prizeTitle}! 
Ticket: ${ticket.ticketNumber}
Matched: ${matches} numbers
Prize: $${prizeAmount}
Your winnings have been credited to your account.
Check your wallet balance now!`;

      await notificationService.sendSMS(user.phone, message);
      
      console.log(`Notified winner: User ${user.id}, Prize: $${prizeAmount}, Matches: ${matches}`);
      
    } catch (error) {
      console.error('Error sending winner notification:', error);
    }
  }

  /**
   * Get draw type by drawId
   */
  private async getDrawType(drawId: number): Promise<'daily' | 'weekly'> {
    try {
      // Try to get from recent draws
      const dailyDraw = await storage.getLatestDraw('daily');
      const weeklyDraw = await storage.getLatestDraw('weekly');
      
      if (dailyDraw && dailyDraw.id === drawId) return 'daily';
      if (weeklyDraw && weeklyDraw.id === drawId) return 'weekly';
      
      // Fallback: check all draws
      const allDraws = await storage.getAllDraws();
      const draw = allDraws.find(d => d.id === drawId);
      
      return draw?.type as 'daily' | 'weekly' || 'daily';
    } catch (error) {
      console.error('Error determining draw type:', error);
      return 'daily';
    }
  }

  /**
   * Get winners summary for a draw
   */
  public async getDrawWinners(drawId: number): Promise<{
    draw: LotteryDraw | null;
    winners: Array<{
      ticketNumber: string;
      userName: string;
      matchedNumbers: number;
      prizeAmount: string;
      isJackpotWinner: boolean;
    }>;
    summary: {
      totalWinners: number;
      totalPrizesPaid: string;
      jackpotWinners: number;
    };
  }> {
    try {
      const tickets = await storage.getTicketsByDraw(drawId);
      const winners = [];
      let totalPrizesPaid = 0;
      let jackpotWinners = 0;

      // Get draw info
      const drawType = await this.getDrawType(drawId);
      const draw = await storage.getLatestDraw(drawType);

      for (const ticket of tickets) {
        if (ticket.isWinner && parseFloat(ticket.prizeAmount) > 0) {
          const user = await storage.getUser(ticket.userId);
          const isJackpot = (drawType === 'daily' && ticket.matchedNumbers === 5) || 
                          (drawType === 'weekly' && ticket.matchedNumbers === 6);
          
          if (isJackpot) jackpotWinners++;
          totalPrizesPaid += parseFloat(ticket.prizeAmount);

          winners.push({
            ticketNumber: ticket.ticketNumber,
            userName: user?.name || 'Unknown',
            matchedNumbers: ticket.matchedNumbers,
            prizeAmount: ticket.prizeAmount,
            isJackpotWinner: isJackpot
          });
        }
      }

      return {
        draw,
        winners: winners.sort((a, b) => b.matchedNumbers - a.matchedNumbers),
        summary: {
          totalWinners: winners.length,
          totalPrizesPaid: totalPrizesPaid.toFixed(2),
          jackpotWinners
        }
      };

    } catch (error) {
      console.error('Error getting draw winners:', error);
      return {
        draw: null,
        winners: [],
        summary: {
          totalWinners: 0,
          totalPrizesPaid: "0.00",
          jackpotWinners: 0
        }
      };
    }
  }

  /**
   * Get user's winning history
   */
  public async getUserWinningHistory(userId: number): Promise<Array<{
    drawId: number;
    drawType: string;
    drawDate: Date;
    ticketNumber: string;
    winningNumbers: number[];
    matchedNumbers: number;
    prizeAmount: string;
    isJackpotWin: boolean;
  }>> {
    try {
      const userTickets = await storage.getTicketsByUser(userId);
      const winningTickets = userTickets.filter(ticket => ticket.isWinner);
      
      const winningHistory = [];
      
      for (const ticket of winningTickets) {
        const drawType = await this.getDrawType(ticket.drawId);
        const draw = await storage.getLatestDraw(drawType);
        
        if (draw) {
          const isJackpot = (drawType === 'daily' && ticket.matchedNumbers === 5) || 
                          (drawType === 'weekly' && ticket.matchedNumbers === 6);
          
          winningHistory.push({
            drawId: ticket.drawId,
            drawType: draw.type,
            drawDate: draw.drawDate,
            ticketNumber: ticket.ticketNumber,
            winningNumbers: draw.winningNumbers,
            matchedNumbers: ticket.matchedNumbers,
            prizeAmount: ticket.prizeAmount,
            isJackpotWin: isJackpot
          });
        }
      }
      
      return winningHistory.sort((a, b) => b.drawDate.getTime() - a.drawDate.getTime());
      
    } catch (error) {
      console.error('Error getting user winning history:', error);
      return [];
    }
  }
}

export const winnerService = WinnerService.getInstance();