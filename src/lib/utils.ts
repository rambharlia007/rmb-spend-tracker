import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// jsPDF's default Helvetica font lacks the ₹ glyph (renders as ¹ with bad spacing),
// so PDFs use plain Indian-grouped numbers without any currency prefix.
// The PDF context (title, summary headings) already makes the unit clear.
export function formatINRForPDF(amount: number): string {
  const n = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(amount));
  return amount < 0 ? `-${n}` : n;
}
