export function generateQuickPickNumbers(count: number, max: number): number[] {
  const numbers: number[] = [];
  while (numbers.length < count) {
    const num = Math.floor(Math.random() * max) + 1;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b);
}

export function formatCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPhoneNumber(phone: string): string {
  // Ensure Zimbabwe format (+263...)
  if (phone.startsWith('0')) {
    return '+263' + phone.substring(1);
  }
  if (!phone.startsWith('+263')) {
    return '+263' + phone;
  }
  return phone;
}

export function generateTicketNumber(): string {
  return 'MT' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
}

export function generateAgentCode(): string {
  return 'AG' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
}