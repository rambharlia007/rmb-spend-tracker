import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Category, PaymentSource, Spend, SharedLoan } from '@/types';
import { formatINR } from '@/lib/utils';
import type { FilterState } from '@/components/FilterBar';
import { PRESET_LABELS } from '@/lib/dateRanges';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';   // prevent HashRouter intercepting the click as navigation
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoke so browser has time to initiate the download (mobile Safari fix)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSpendsCSV(
  spends: Spend[],
  catMap: Map<string, Category>,
  srcMap: Map<string, PaymentSource>
) {
  const header = ['Date', 'Amount', 'Category', 'Payment Source', 'Notes'];
  const rows = spends.map((s) => [
    format(s.date.toDate(), 'yyyy-MM-dd'),
    s.amount.toString(),
    catMap.get(s.categoryId)?.name ?? '',
    srcMap.get(s.paymentSourceId)?.name ?? '',
    (s.notes ?? '').replace(/\n/g, ' ').replace(/"/g, '""')
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(','))
    .join('\n');
  download(`spends-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`, csv, 'text/csv');
}

export function exportSpendsPDF(
  spends: Spend[],
  catMap: Map<string, Category>,
  srcMap: Map<string, PaymentSource>,
  workspaceName: string,
  filters: FilterState
) {
  const doc = new jsPDF();
  const now = new Date();
  const total = spends.reduce((a, b) => a + b.amount, 0);

  doc.setFontSize(18);
  doc.text('Spend Report', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(workspaceName, 14, 27);
  doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, 14, 33);
  doc.text(`Period: ${PRESET_LABELS[filters.preset]}`, 14, 39);
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total: ${formatINR(total)}  (${spends.length} entries)`, 14, 48);

  // Table
  autoTable(doc, {
    startY: 54,
    head: [['Date', 'Category', 'Source', 'Notes', 'Amount']],
    body: spends.map((s) => [
      format(s.date.toDate(), 'dd MMM'),
      catMap.get(s.categoryId)?.name ?? '',
      srcMap.get(s.paymentSourceId)?.name ?? '',
      s.notes ?? '',
      formatINR(s.amount)
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 4: { halign: 'right' } }
  });

  // Category summary
  const byCat = new Map<string, number>();
  for (const s of spends) {
    const name = catMap.get(s.categoryId)?.name ?? 'Unknown';
    byCat.set(name, (byCat.get(name) ?? 0) + s.amount);
  }
  const summary = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 54;

  autoTable(doc, {
    startY: finalY + 10,
    head: [['Category', 'Total', '%']],
    body: summary.map(([name, amt]) => [name, formatINR(amt), total > 0 ? ((amt / total) * 100).toFixed(1) + '%' : '—']),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
  });

  // Use blob + anchor instead of doc.save() to avoid jsPDF's internal window.open()
  // which can trigger router navigation and kill all Firestore subscriptions.
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spends-${format(now, 'yyyyMMdd-HHmm')}.pdf`;
  a.target = '_blank';   // prevent HashRouter intercepting the click as navigation
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Per-contact loan statement (bank-statement style) ---
// Shows all loans given + taken with a running balance, sorted by date.
// Credit = they owe me (I lent them), Debit = I owe them (they lent me).
export function generateLoanStatementPDF(opts: {
  myName: string;
  contactName: string;
  contactEmail: string;
  givenLoans: SharedLoan[];   // all loans I gave to this contact (any status)
  takenLoans: SharedLoan[];   // all loans they gave me (any status)
  fromDate: Date | null;
  toDate: Date | null;
}) {
  const { myName, contactName, contactEmail, fromDate, toDate } = opts;
  const now = new Date();

  // Filter by date range if provided
  const inRange = (l: SharedLoan) => {
    const d = l.date.toDate();
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };
  const given = opts.givenLoans.filter(inRange);
  const taken = opts.takenLoans.filter(inRange);

  // Merge into a single timeline sorted by date ascending
  type Row = {
    date: Date;
    description: string;
    credit: number;   // I lent them (they owe me)
    debit: number;    // They lent me (I owe them)
    status: string;
  };

  const rows: Row[] = [
    ...given.map((l) => ({
      date: l.date.toDate(),
      description: l.notes ? `Lent · ${l.notes}` : 'Lent',
      credit: l.amount,
      debit: 0,
      status: l.status,
    })),
    ...taken.map((l) => ({
      date: l.date.toDate(),
      description: l.notes ? `Borrowed · ${l.notes}` : 'Borrowed',
      credit: 0,
      debit: l.amount,
      status: l.status,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance: positive = they owe me net, negative = I owe them net
  let runningBalance = 0;
  const tableBody = rows.map((r) => {
    runningBalance += r.credit - r.debit;
    const balStr = runningBalance >= 0
      ? `${formatINR(runningBalance)} DR`   // DR = they owe me (I'm a debtor's creditor)
      : `${formatINR(Math.abs(runningBalance))} CR`; // CR = I owe them
    return [
      format(r.date, 'dd MMM yyyy'),
      r.description,
      r.credit > 0 ? formatINR(r.credit) : '—',
      r.debit > 0 ? formatINR(r.debit) : '—',
      balStr,
      r.status,
    ];
  });

  const totalLent = given.reduce((s, l) => s + l.amount, 0);
  const totalBorrowed = taken.reduce((s, l) => s + l.amount, 0);
  const closingBalance = totalLent - totalBorrowed;

  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('Loan Statement', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`My account: ${myName}`, 14, 28);
  doc.text(`With: ${contactName} (${contactEmail})`, 14, 34);
  doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, 14, 40);
  if (fromDate || toDate) {
    const range = `${fromDate ? format(fromDate, 'dd MMM yyyy') : 'beginning'} → ${toDate ? format(toDate, 'dd MMM yyyy') : 'today'}`;
    doc.text(`Period: ${range}`, 14, 46);
  }
  doc.setTextColor(0);

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.text('No transactions found for the selected period.', 14, 58);
  } else {
    // Summary box
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total lent: ${formatINR(totalLent)}   Total borrowed: ${formatINR(totalBorrowed)}`, 14, 54);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 60,
      head: [['Date', 'Description', 'Lent (CR)', 'Borrowed (DR)', 'Balance', 'Status']],
      body: tableBody,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    // Closing balance row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? 60;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const closingLabel = closingBalance >= 0
      ? `Closing balance: ${formatINR(closingBalance)} — they owe you`
      : `Closing balance: ${formatINR(Math.abs(closingBalance))} — you owe them`;
    doc.text(closingLabel, 14, finalY + 10);
    doc.setFont('helvetica', 'normal');
  }

  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (contactName || contactEmail).replace(/[^a-z0-9]/gi, '_');
  a.download = `loan-statement-${safeName}-${format(now, 'yyyyMMdd')}.pdf`;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
