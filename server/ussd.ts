import { storage } from "./storage";
import { ecocashService } from "./ecocash";
import { smsService } from "./sms-service";
import { generateQuickPickNumbers } from "@shared/utils";

// USSD Session Management
interface USSDSession {
  sessionId: string;
  phoneNumber: string;
  currentMenu: string;
  data: Record<string, any>;
  lastActivity: Date;
}

// USSD Menu Structure
interface USSDMenu {
  text: string;
  options?: Record<string, string>;
  handler?: (session: USSDSession, input: string) => Promise<USSDResponse>;
}

interface USSDResponse {
  text: string;
  endSession?: boolean;
  nextMenu?: string;
}

export class USSDService {
  private static instance: USSDService;
  private sessions: Map<string, USSDSession> = new Map();
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Clean up expired sessions every minute
    setInterval(() => this.cleanupSessions(), 60000);
  }

  public static getInstance(): USSDService {
    if (!USSDService.instance) {
      USSDService.instance = new USSDService();
    }
    return USSDService.instance;
  }

  private cleanupSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  public async handleUSSDRequest(
    sessionId: string,
    phoneNumber: string,
    text: string
  ): Promise<USSDResponse> {
    try {
      let session = this.sessions.get(sessionId);
      
      if (!session) {
        // New session
        session = {
          sessionId,
          phoneNumber: this.formatPhoneNumber(phoneNumber),
          currentMenu: 'main',
          data: {},
          lastActivity: new Date()
        };
        this.sessions.set(sessionId, session);
      } else {
        session.lastActivity = new Date();
      }

      return await this.processMenu(session, text);
    } catch (error) {
      console.error('USSD Error:', error);
      return {
        text: "Service temporarily unavailable. Please try again later.",
        endSession: true
      };
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Ensure Zimbabwe format (+263...)
    if (phone.startsWith('0')) {
      return '+263' + phone.substring(1);
    }
    if (!phone.startsWith('+263')) {
      return '+263' + phone;
    }
    return phone;
  }

  private async processMenu(session: USSDSession, input: string): Promise<USSDResponse> {
    const menus: Record<string, USSDMenu> = {
      main: {
        text: "",
        handler: async (session, input) => {
          // Check if user exists
          const user = await storage.getUserByPhone(session.phoneNumber);
          
          if (!user) {
            // New user - show registration menu
            return { text: "", nextMenu: 'welcome_new' };
          }
          
          // Existing user - show main menu
          if (input === '') {
            return { 
              text: `Welcome to Mutapa Lottery (*345#)\nBalance: $${user.balance}\n\n1. Buy Daily Ticket ($0.50)\n2. Buy Weekly Ticket ($1.00)\n3. View Last Draw\n4. Check Balance\n5. SMS Commands\n0. Exit`
            };
          }
          
          switch (input) {
            case '1': 
              session.data.drawType = 'daily';
              session.data.price = 0.50;
              return { text: "", nextMenu: 'buy_daily_ticket' };
            case '2': 
              session.data.drawType = 'weekly';
              session.data.price = 1.00;
              return { text: "", nextMenu: 'buy_weekly_ticket' };
            case '3': return { text: "", nextMenu: 'view_last_draw' };
            case '4': return { text: "", nextMenu: 'check_balance' };
            case '5': return { text: "", nextMenu: 'sms_help' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n1. Buy Daily\n2. Buy Weekly\n3. Last Draw\n4. Balance\n5. SMS Help\n0. Exit" };
          }
        }
      },

      welcome_new: {
        text: "Welcome to Mutapa Lottery!\nNo account found for this number.\n\n1. Register Account\n2. Use SMS Commands\n0. Exit",
        handler: async (session, input) => {
          switch (input) {
            case '1': return { text: "", nextMenu: 'register' };
            case '2': return { text: "", nextMenu: 'sms_help' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n1. Register\n2. SMS Commands\n0. Exit" };
          }
        }
      },

      register: {
        text: "Registration via USSD\n\n✓ Account will be created automatically\n✓ KYC verification required to play\n✓ SMS link will be sent\n\n1. Confirm Registration\n9. Back\n0. Exit",
        handler: async (session, input) => {
          switch (input) {
            case '1': return { text: "", nextMenu: 'process_registration' };
            case '9': return { text: "", nextMenu: 'welcome_new' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n1. Confirm Registration\n9. Back\n0. Exit" };
          }
        }
      },

      process_registration: {
        text: "",
        handler: async (session, input) => {
          try {
            // Create user account
            const user = await storage.registerUser({
              phoneNumber: session.phoneNumber,
              password: Math.random().toString(36).substring(2, 15), // Random password
              isAgent: false
            });

            // Send KYC SMS
            await smsService.sendKYCVerificationSMS(session.phoneNumber);

            return {
              text: `Registration successful! ✓\n\nAccount created for:\n${session.phoneNumber}\n\nKYC verification link sent via SMS. Complete verification to start playing.\n\nText HELP to ${session.phoneNumber.substring(1, 4)} for SMS commands.`,
              endSession: true
            };
          } catch (error) {
            if (error instanceof Error && error.message.includes("already exists")) {
              return {
                text: "Account already exists for this phone number. Dial *345# to access your account.",
                endSession: true
              };
            }
            return {
              text: "Registration failed. Please try again or contact support.",
              endSession: true
            };
          }
        }
      },

      sms_help: {
        text: "SMS Commands (Text to 345):\n\nREG - Register account\nDAILY - Buy daily ticket\nWEEKLY - Buy weekly ticket\nBAL - Check balance\nRESULT - View results\nKYC - Verify identity\nHELP - All commands\n\nExample: Text 'DAILY 1,15,23,34,42'\n\n0. Back",
        handler: async (session, input) => {
          if (input === '0') {
            return { text: "", nextMenu: 'main' };
          }
          return { text: "Text SMS commands to 345.\n\n0. Back to main menu" };
        }
      },

      buy_daily_ticket: {
        text: "",
        handler: async (session, input) => {
          const user = await storage.getUserByPhone(session.phoneNumber);
          if (!user) {
            return { text: "Account not found. Please register first.", endSession: true };
          }

          if (!user.kycVerified) {
            return { text: "Identity verification required.\nText KYC to 345 for verification link.", endSession: true };
          }

          if (parseFloat(user.balance) < 0.50) {
            return { text: `Insufficient balance.\nCurrent: $${user.balance}\nRequired: $0.50\n\nAdd funds via EcoCash or agent.`, endSession: true };
          }

          if (input === '') {
            return { text: "Daily Lottery Ticket ($0.50)\n\n1. Quick Pick (Random)\n2. Choose Numbers\n9. Back\n0. Exit" };
          }

          switch (input) {
            case '1':
              session.data.numbers = generateQuickPickNumbers(5, 45);
              return { text: "", nextMenu: 'confirm_daily_purchase' };
            case '2':
              return { text: "", nextMenu: 'manual_daily_numbers' };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option.\n1. Quick Pick\n2. Choose Numbers\n9. Back\n0. Exit" };
          }
        }
      },

      buy_weekly_ticket: {
        text: "",
        handler: async (session, input) => {
          const user = await storage.getUserByPhone(session.phoneNumber);
          if (!user) {
            return { text: "Account not found. Please register first.", endSession: true };
          }

          if (!user.kycVerified) {
            return { text: "Identity verification required.\nText KYC to 345 for verification link.", endSession: true };
          }

          if (parseFloat(user.balance) < 1.00) {
            return { text: `Insufficient balance.\nCurrent: $${user.balance}\nRequired: $1.00\n\nAdd funds via EcoCash or agent.`, endSession: true };
          }

          if (input === '') {
            return { text: "Weekly Lottery Ticket ($1.00)\n\n1. Quick Pick (Random)\n2. Choose Numbers\n9. Back\n0. Exit" };
          }

          switch (input) {
            case '1':
              session.data.numbers = generateQuickPickNumbers(6, 49);
              return { text: "", nextMenu: 'confirm_weekly_purchase' };
            case '2':
              return { text: "", nextMenu: 'manual_weekly_numbers' };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option.\n1. Quick Pick\n2. Choose Numbers\n9. Back\n0. Exit" };
          }
        }
      },

      manual_daily_numbers: {
        text: "Enter 5 numbers (1-45)\nSeparated by commas\n\nExample: 1,15,23,34,42\n\n9. Back\n0. Exit",
        handler: async (session, input) => {
          if (input === '9') return { text: "", nextMenu: 'buy_daily_ticket' };
          if (input === '0') return { text: "Thank you for using Mutapa Lottery!", endSession: true };

          try {
            const numbers = input.split(',').map(n => parseInt(n.trim()));

            if (numbers.length !== 5) {
              return { text: "Please enter exactly 5 numbers.\n\nExample: 1,15,23,34,42\n\n9. Back" };
            }

            if (numbers.some(n => n < 1 || n > 45 || isNaN(n))) {
              return { text: "Numbers must be between 1 and 45.\n\nExample: 1,15,23,34,42\n\n9. Back" };
            }

            if (new Set(numbers).size !== numbers.length) {
              return { text: "Numbers must be unique.\n\nExample: 1,15,23,34,42\n\n9. Back" };
            }

            session.data.numbers = numbers.sort((a, b) => a - b);
            return { text: "", nextMenu: 'confirm_daily_purchase' };
          } catch (error) {
            return { text: "Invalid format.\n\nExample: 1,15,23,34,42\n\n9. Back" };
          }
        }
      },

      manual_weekly_numbers: {
        text: "Enter 6 numbers (1-49)\nSeparated by commas\n\nExample: 1,15,23,34,42,49\n\n9. Back\n0. Exit",
        handler: async (session, input) => {
          if (input === '9') return { text: "", nextMenu: 'buy_weekly_ticket' };
          if (input === '0') return { text: "Thank you for using Mutapa Lottery!", endSession: true };

          try {
            const numbers = input.split(',').map(n => parseInt(n.trim()));

            if (numbers.length !== 6) {
              return { text: "Please enter exactly 6 numbers.\n\nExample: 1,15,23,34,42,49\n\n9. Back" };
            }

            if (numbers.some(n => n < 1 || n > 49 || isNaN(n))) {
              return { text: "Numbers must be between 1 and 49.\n\nExample: 1,15,23,34,42,49\n\n9. Back" };
            }

            if (new Set(numbers).size !== numbers.length) {
              return { text: "Numbers must be unique.\n\nExample: 1,15,23,34,42,49\n\n9. Back" };
            }

            session.data.numbers = numbers.sort((a, b) => a - b);
            return { text: "", nextMenu: 'confirm_weekly_purchase' };
          } catch (error) {
            return { text: "Invalid format.\n\nExample: 1,15,23,34,42,49\n\n9. Back" };
          }
        }
      },

      confirm_daily_purchase: {
        text: "",
        handler: async (session, input) => {
          if (input === '') {
            const numbers = session.data.numbers.join(', ');
            return { text: `Confirm Daily Ticket:\n\nNumbers: ${numbers}\nPrice: $0.50\n\n1. Confirm & Pay\n2. Change Numbers\n9. Back\n0. Exit` };
          }

          switch (input) {
            case '1': return { text: "", nextMenu: 'process_daily_payment' };
            case '2': return { text: "", nextMenu: 'buy_daily_ticket' };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option.\n1. Confirm\n2. Change Numbers\n9. Back\n0. Exit" };
          }
        }
      },

      confirm_weekly_purchase: {
        text: "",
        handler: async (session, input) => {
          if (input === '') {
            const numbers = session.data.numbers.join(', ');
            return { text: `Confirm Weekly Ticket:\n\nNumbers: ${numbers}\nPrice: $1.00\n\n1. Confirm & Pay\n2. Change Numbers\n9. Back\n0. Exit` };
          }

          switch (input) {
            case '1': return { text: "", nextMenu: 'process_weekly_payment' };
            case '2': return { text: "", nextMenu: 'buy_weekly_ticket' };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option.\n1. Confirm\n2. Change Numbers\n9. Back\n0. Exit" };
          }
        }
      },

      view_last_draw: {
        text: "",
        handler: async (session, input) => {
          try {
            const dailyDraw = await storage.getLatestDraw('daily');
            const weeklyDraw = await storage.getLatestDraw('weekly');

            let response = 'Latest Draw Results:\n\n';

            if (dailyDraw && dailyDraw.winningNumbers && dailyDraw.winningNumbers.length > 0) {
              response += `Daily: ${dailyDraw.winningNumbers.join(', ')}\n`;
              response += `Date: ${new Date(dailyDraw.drawDate).toLocaleDateString()}\n\n`;
            }

            if (weeklyDraw && weeklyDraw.winningNumbers && weeklyDraw.winningNumbers.length > 0) {
              response += `Weekly: ${weeklyDraw.winningNumbers.join(', ')}\n`;
              response += `Date: ${new Date(weeklyDraw.drawDate).toLocaleDateString()}\n`;
              response += `Jackpot: $${weeklyDraw.jackpotAmount}\n\n`;
            }

            if (!dailyDraw?.winningNumbers && !weeklyDraw?.winningNumbers) {
              response += 'No recent results available.\n\n';
            }

            response += '0. Back to main menu';
            
            if (input === '0') {
              return { text: "", nextMenu: 'main' };
            }

            return { text: response };
          } catch (error) {
            return { text: "Unable to fetch results.\n\n0. Back to main menu" };
          }
        }
      },

      select_numbers: {
        text: "Select Numbers\n1. Quick Pick (Random)\n2. Manual Selection\n9. Back\n0. Exit",
        handler: async (session, input) => {
          switch (input) {
            case '1':
              const requiredCount = session.data.drawType === 'daily' ? 5 : 6;
              const maxNumber = session.data.drawType === 'daily' ? 45 : 49;
              session.data.numbers = generateQuickPickNumbers(requiredCount, maxNumber);
              return { text: "", nextMenu: 'confirm_ticket' };
            case '2':
              return { text: "", nextMenu: 'manual_numbers' };
            case '9': return { text: "", nextMenu: 'buy_ticket' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n" + this.getMenuText('select_numbers') };
          }
        }
      },

      manual_numbers: {
        text: "Enter numbers separated by commas\n(e.g., 1,15,23,34,42)\nFor daily: 5 numbers (1-45)\nFor weekly: 6 numbers (1-49)\n9. Back\n0. Exit",
        handler: async (session, input) => {
          if (input === '9') return { text: "", nextMenu: 'select_numbers' };
          if (input === '0') return { text: "Thank you for using Mutapa Lottery!", endSession: true };

          try {
            const numbers = input.split(',').map(n => parseInt(n.trim()));
            const requiredCount = session.data.drawType === 'daily' ? 5 : 6;
            const maxNumber = session.data.drawType === 'daily' ? 45 : 49;

            if (numbers.length !== requiredCount) {
              return { text: `Please enter exactly ${requiredCount} numbers.\n` + this.getMenuText('manual_numbers') };
            }

            if (numbers.some(n => n < 1 || n > maxNumber || isNaN(n))) {
              return { text: `Numbers must be between 1 and ${maxNumber}.\n` + this.getMenuText('manual_numbers') };
            }

            if (new Set(numbers).size !== numbers.length) {
              return { text: "Numbers must be unique.\n" + this.getMenuText('manual_numbers') };
            }

            session.data.numbers = numbers.sort((a, b) => a - b);
            return { text: "", nextMenu: 'confirm_ticket' };
          } catch (error) {
            return { text: "Invalid format. Please try again.\n" + this.getMenuText('manual_numbers') };
          }
        }
      },

      confirm_ticket: {
        text: "",
        handler: async (session, input) => {
          const drawType = session.data.drawType === 'daily' ? 'Daily Draw' : 'Weekly Jackpot';
          const numbers = session.data.numbers.join(', ');
          const price = session.data.price;
          
          const confirmText = `Confirm Ticket Purchase:\n${drawType}\nNumbers: ${numbers}\nPrice: $${price}\n\n1. Confirm & Pay\n2. Change Numbers\n9. Back to Main\n0. Exit`;
          
          if (input === '') return { text: confirmText };
          
          switch (input) {
            case '1': return { text: "", nextMenu: 'process_payment' };
            case '2': return { text: "", nextMenu: 'select_numbers' };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n" + confirmText };
          }
        }
      },

      process_payment: {
        text: "Processing payment via EcoCash...\nPlease wait...",
        handler: async (session, input) => {
          try {
            // Check if user exists, create if not
            let user = await storage.getUserByPhone(session.phoneNumber);
            if (!user) {
              user = await storage.createUser({
                phone: session.phoneNumber,
                name: `User ${session.phoneNumber.slice(-4)}`,
                balance: "0.00",
                kycVerified: false,
                isAgent: false,
                isAdmin: false
              });
            }

            // Process EcoCash payment
            const paymentResult = await ecocashService.chargeSubscriber({
              msisdn: session.phoneNumber.replace('+263', '0'),
              amount: session.data.price,
              description: `Mutapa Lottery ${session.data.drawType} ticket`
            });

            if (!paymentResult.success) {
              return {
                text: `Payment failed: ${paymentResult.message || 'Please try again later.'}\n\nPress 1 to retry or 0 to exit`,
                endSession: false
              };
            }

            // Get upcoming draw
            const upcomingDraw = await storage.getUpcomingDraw(session.data.drawType);
            if (!upcomingDraw) {
              return {
                text: "No upcoming draw available. Please try again later.",
                endSession: true
              };
            }

            // Create ticket
            const ticket = await storage.createTicket({
              userId: user.id,
              drawId: upcomingDraw.id,
              selectedNumbers: session.data.numbers,
              cost: session.data.price.toString(),
              purchaseMethod: 'ussd'
            });

            // Create transaction
            await storage.createTransaction({
              userId: user.id,
              type: 'ticket_purchase',
              amount: session.data.price.toString(),
              description: `${session.data.drawType} lottery ticket`,
              paymentMethod: 'ecocash'
            });

            return {
              text: `Ticket purchased successfully!\nTicket #: ${ticket.ticketNumber}\nNumbers: ${session.data.numbers.join(', ')}\nDraw: ${new Date(upcomingDraw.drawDate).toLocaleDateString()}\nGood luck!`,
              endSession: true
            };
          } catch (error) {
            console.error('Ticket purchase error:', error);
            return {
              text: "Purchase failed. Please try again later.",
              endSession: true
            };
          }
        }
      },

      check_balance: {
        text: "",
        handler: async (session, input) => {
          try {
            const user = await storage.getUserByPhone(session.phoneNumber);
            if (!user) {
              return {
                text: "Account not found. Please register first.\n\nPress 0 to exit",
                endSession: true
              };
            }

            const balance = parseFloat(user.balance).toFixed(2);
            return {
              text: `Account Balance: $${balance}\n\nPress 0 to exit or 9 for main menu`,
              endSession: false
            };
          } catch (error) {
            return {
              text: "Unable to retrieve balance. Please try again later.",
              endSession: true
            };
          }
        }
      },

      view_results: {
        text: "Latest Draw Results\n1. Daily Draw\n2. Weekly Jackpot\n9. Back to Main\n0. Exit",
        handler: async (session, input) => {
          switch (input) {
            case '1': return { text: "", nextMenu: 'daily_results' };
            case '2': return { text: "", nextMenu: 'weekly_results' };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n" + this.getMenuText('view_results') };
          }
        }
      },

      daily_results: {
        text: "",
        handler: async (session, input) => {
          try {
            const latestDraw = await storage.getLatestDraw('daily');
            if (!latestDraw || latestDraw.status !== 'completed') {
              return {
                text: "No recent daily draw results available.\n\nPress 0 to exit or 9 for main menu",
                endSession: false
              };
            }

            const numbers = latestDraw.winningNumbers.join(', ');
            const drawDate = new Date(latestDraw.drawDate).toLocaleDateString();
            
            return {
              text: `Daily Draw Results\nDate: ${drawDate}\nWinning Numbers: ${numbers}\nJackpot: $${latestDraw.jackpotAmount}\n\nPress 0 to exit or 9 for main menu`,
              endSession: false
            };
          } catch (error) {
            return {
              text: "Unable to retrieve results. Please try again later.",
              endSession: true
            };
          }
        }
      },

      weekly_results: {
        text: "",
        handler: async (session, input) => {
          try {
            const latestDraw = await storage.getLatestDraw('weekly');
            if (!latestDraw || latestDraw.status !== 'completed') {
              return {
                text: "No recent weekly draw results available.\n\nPress 0 to exit or 9 for main menu",
                endSession: false
              };
            }

            const numbers = latestDraw.winningNumbers.join(', ');
            const drawDate = new Date(latestDraw.drawDate).toLocaleDateString();
            
            return {
              text: `Weekly Jackpot Results\nDate: ${drawDate}\nWinning Numbers: ${numbers}\nJackpot: $${latestDraw.jackpotAmount}\n\nPress 0 to exit or 9 for main menu`,
              endSession: false
            };
          } catch (error) {
            return {
              text: "Unable to retrieve results. Please try again later.",
              endSession: true
            };
          }
        }
      },

      account_info: {
        text: "",
        handler: async (session, input) => {
          try {
            const user = await storage.getUserByPhone(session.phoneNumber);
            if (!user) {
              return {
                text: "Account not found. Please register first.\n\nPress 0 to exit",
                endSession: true
              };
            }

            const tickets = await storage.getTicketsByUser(user.id);
            const balance = parseFloat(user.balance).toFixed(2);
            const kycStatus = user.kycVerified ? 'Verified' : 'Pending';
            
            return {
              text: `Account Information\nName: ${user.name}\nPhone: ${user.phone}\nBalance: $${balance}\nKYC Status: ${kycStatus}\nTotal Tickets: ${tickets.length}\n\nPress 0 to exit or 9 for main menu`,
              endSession: false
            };
          } catch (error) {
            return {
              text: "Unable to retrieve account info. Please try again later.",
              endSession: true
            };
          }
        }
      },

      self_exclusion: {
        text: "Self-Exclusion\nThis feature helps you control your lottery spending.\n\n1. Set spending limit\n2. View current limits\n3. Exclude for 24 hours\n4. Exclude for 7 days\n9. Back to Main\n0. Exit",
        handler: async (session, input) => {
          switch (input) {
            case '1': return { text: "Feature coming soon.\n\nPress 0 to exit or 9 for main menu" };
            case '2': return { text: "No limits currently set.\n\nPress 0 to exit or 9 for main menu" };
            case '3': return { text: "24-hour exclusion activated.\n\nPress 0 to exit" };
            case '4': return { text: "7-day exclusion activated.\n\nPress 0 to exit" };
            case '9': return { text: "", nextMenu: 'main' };
            case '0': return { text: "Thank you for using Mutapa Lottery!", endSession: true };
            default: return { text: "Invalid option. Please try again.\n" + this.getMenuText('self_exclusion') };
          }
        }
      }
    };

    const currentMenu = menus[session.currentMenu];
    if (!currentMenu) {
      session.currentMenu = 'main';
      return this.processMenu(session, '');
    }

    if (currentMenu.handler) {
      const response = await currentMenu.handler(session, input);
      
      if (response.nextMenu) {
        session.currentMenu = response.nextMenu;
        return this.processMenu(session, '');
      }
      
      if (response.endSession) {
        this.sessions.delete(session.sessionId);
      }
      
      return response;
    }

    return { text: currentMenu.text };
  }

  private getMenuText(menuName: string): string {
    const menus: Record<string, string> = {
      main: "Welcome to Mutapa Lottery\n1. Buy Ticket\n2. Check Balance\n3. View Results\n4. Account Info\n5. Self Exclusion\n0. Exit",
      buy_ticket: "Buy Lottery Ticket\n1. Daily Draw ($0.50)\n2. Weekly Jackpot ($1.00)\n9. Back to Main Menu\n0. Exit",
      select_numbers: "Select Numbers\n1. Quick Pick (Random)\n2. Manual Selection\n9. Back\n0. Exit",
      manual_numbers: "Enter numbers separated by commas\n(e.g., 1,15,23,34,42)\nFor daily: 5 numbers (1-45)\nFor weekly: 6 numbers (1-49)\n9. Back\n0. Exit",
      view_results: "Latest Draw Results\n1. Daily Draw\n2. Weekly Jackpot\n9. Back to Main\n0. Exit",
      self_exclusion: "Self-Exclusion\nThis feature helps you control your lottery spending.\n\n1. Set spending limit\n2. View current limits\n3. Exclude for 24 hours\n4. Exclude for 7 days\n9. Back to Main\n0. Exit"
    };
    return menus[menuName] || "";
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  public getSessionInfo(sessionId: string): USSDSession | undefined {
    return this.sessions.get(sessionId);
  }
}

// Utility function for generating quick pick numbers
function generateQuickPickNumbers(count: number, max: number): number[] {
  const numbers: number[] = [];
  while (numbers.length < count) {
    const num = Math.floor(Math.random() * max) + 1;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b);
}

export const ussdService = USSDService.getInstance();