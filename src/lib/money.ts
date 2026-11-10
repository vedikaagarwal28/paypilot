/** Money is integer cents everywhere; these are the only conversions to and from PayPal strings. */

export function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function toCents(value: string): number {
  return Math.round(Number.parseFloat(value) * 100);
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}
