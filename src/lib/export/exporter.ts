import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Category, PaymentSource, Spend, SharedLoan } from '@/types';
import { formatINRForPDF } from '@/lib/utils';
import type { FilterState } from '@/components/FilterBar';
import { PRESET_LABELS } from '@/lib/dateRanges';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  triggerDownload(blob, filename);
}

// Centralised download trigger. NO target="_blank" — in standalone PWA mode the SW's
// navigateFallback intercepts the new-tab navigation for a blob URL and hangs the app.
// The download attribute alone is enough; blob: URLs are not intercepted by any router.
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const total = spends.reduce((a, b) => a + b.amount, 0);

  // Sort spends oldest → newest so the report reads like a timeline.
  const sorted = [...spends].sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
  const avg = spends.length > 0 ? total / spends.length : 0;

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Spend Report', margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${format(now, 'dd MMM yyyy, HH:mm')}`, pageW - margin, 22, { align: 'right' });

  doc.setDrawColor(225);
  doc.setLineWidth(0.3);
  doc.line(margin, 26, pageW - margin, 26);

  // Identity block
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Workspace', margin, 34);
  doc.text('Period', margin, 41);

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text(workspaceName || '—', margin + 32, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(PRESET_LABELS[filters.preset], margin + 32, 41);

  if (spends.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text('No spends found for the selected period.', margin, 56);
    triggerDownload(doc.output('blob'), `spends-${format(now, 'yyyyMMdd-HHmm')}.pdf`);
    return;
  }

  // --- KPI summary cards ---
  const cardW = (pageW - 2 * margin - 8) / 3;
  const cardH = 18;
  const cardY = 50;
  const drawCard = (x: number, label: string, value: string, isPrimary = false) => {
    doc.setFillColor(isPrimary ? 15 : 248, isPrimary ? 23 : 250, isPrimary ? 42 : 252);
    doc.setDrawColor(isPrimary ? 15 : 226, isPrimary ? 23 : 232, isPrimary ? 42 : 240);
    doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(isPrimary ? 200 : 120);
    doc.text(label.toUpperCase(), x + 4, cardY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(isPrimary ? 255 : 15);
    doc.text(value, x + 4, cardY + 14);
  };

  drawCard(margin, 'Entries', String(spends.length));
  drawCard(margin + cardW + 4, 'Average', formatINRForPDF(avg));
  drawCard(margin + 2 * (cardW + 4), 'Total spent', formatINRForPDF(total), true);

  // --- Transactions table ---
  const txStartY = cardY + cardH + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text('Transactions', margin, txStartY - 3);

  // A4 portrait usable width = 182mm. Sum below = 182.
  autoTable(doc, {
    startY: txStartY,
    margin: { left: margin, right: margin },
    head: [['Date', 'Category', 'Source', 'Notes', 'Amount']],
    body: sorted.map((s) => [
      format(s.date.toDate(), 'dd MMM yy'),
      catMap.get(s.categoryId)?.name ?? '—',
      srcMap.get(s.paymentSourceId)?.name ?? '—',
      s.notes ?? '',
      formatINRForPDF(s.amount),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [232, 234, 240],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [80, 90, 110],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      lineColor: [220, 224, 232],
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [252, 253, 254] },
    columnStyles: {
      0: { cellWidth: 22 },                                       // Date
      1: { cellWidth: 38 },                                       // Category
      2: { cellWidth: 32 },                                       // Source
      3: { cellWidth: 60, overflow: 'linebreak' },                // Notes
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },   // Amount
    },
  });

  // --- Category breakdown ---
  const byCat = new Map<string, number>();
  for (const s of spends) {
    const name = catMap.get(s.categoryId)?.name ?? 'Unknown';
    byCat.set(name, (byCat.get(name) ?? 0) + s.amount);
  }
  const summary = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txFinalY = (doc as any).lastAutoTable?.finalY ?? txStartY;
  const breakdownY = txFinalY + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text('By category', margin, breakdownY - 3);

  autoTable(doc, {
    startY: breakdownY,
    margin: { left: margin, right: margin },
    head: [['Category', 'Total', 'Share']],
    body: summary.map(([name, amt]) => [
      name,
      formatINRForPDF(amt),
      total > 0 ? `${((amt / total) * 100).toFixed(1)}%` : '—',
    ]),
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: [232, 234, 240],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [80, 90, 110],
      fontStyle: 'bold',
      fontSize: 8.5,
      lineColor: [220, 224, 232],
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [252, 253, 254] },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 40, halign: 'right' },
    },
  });

  // --- Total footer ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? breakdownY;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, finalY + 6, pageW - margin, finalY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Total spent', margin, finalY + 13);
  doc.setFontSize(13);
  doc.text(formatINRForPDF(total), pageW - margin, finalY + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text('All amounts in INR.', margin, finalY + 21);

  triggerDownload(doc.output('blob'), `spends-${format(now, 'yyyyMMdd-HHmm')}.pdf`);
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
  };

  const rows: Row[] = [
    ...given.map((l) => ({
      date: l.date.toDate(),
      description: l.notes ? `Lent · ${l.notes}` : 'Lent',
      credit: l.amount,
      debit: 0,
    })),
    ...taken.map((l) => ({
      date: l.date.toDate(),
      description: l.notes ? `Borrowed · ${l.notes}` : 'Borrowed',
      credit: 0,
      debit: l.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Running balance: positive = they owe me net, negative = I owe them net
  let runningBalance = 0;
  const tableBody = rows.map((r) => {
    runningBalance += r.credit - r.debit;
    const balStr = runningBalance === 0
      ? formatINRForPDF(0)
      : runningBalance > 0
        ? `${formatINRForPDF(runningBalance)} DR`
        : `${formatINRForPDF(Math.abs(runningBalance))} CR`;
    return [
      format(r.date, 'dd MMM yyyy'),
      r.description,
      r.credit > 0 ? formatINRForPDF(r.credit) : '',
      r.debit > 0 ? formatINRForPDF(r.debit) : '',
      balStr,
    ];
  });

  const totalLent = given.reduce((s, l) => s + l.amount, 0);
  const totalBorrowed = taken.reduce((s, l) => s + l.amount, 0);
  const closingBalance = totalLent - totalBorrowed;

  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Loan Statement', margin, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${format(now, 'dd MMM yyyy, HH:mm')}`, pageW - margin, 22, { align: 'right' });

  // Divider
  doc.setDrawColor(225);
  doc.setLineWidth(0.3);
  doc.line(margin, 26, pageW - margin, 26);

  // Identity block
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Account holder', margin, 34);
  doc.text('Counterparty', margin, 41);
  if (fromDate || toDate) doc.text('Period', margin, 48);

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text(myName, margin + 32, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`${contactName}   ${contactEmail}`, margin + 32, 41);
  if (fromDate || toDate) {
    const range = `${fromDate ? format(fromDate, 'dd MMM yyyy') : 'Beginning'}  to  ${toDate ? format(toDate, 'dd MMM yyyy') : 'Today'}`;
    doc.text(range, margin + 32, 48);
  }

  const summaryY = (fromDate || toDate) ? 56 : 50;

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text('No transactions found for the selected period.', margin, summaryY + 6);
  } else {
    // --- KPI summary cards ---
    const cardW = (pageW - 2 * margin - 8) / 3;  // 3 cards, 4mm gap between
    const cardH = 18;
    const cardY = summaryY;
    const drawCard = (x: number, label: string, value: string, isPrimary = false) => {
      doc.setFillColor(isPrimary ? 15 : 248, isPrimary ? 23 : 250, isPrimary ? 42 : 252);
      doc.setDrawColor(isPrimary ? 15 : 226, isPrimary ? 23 : 232, isPrimary ? 42 : 240);
      doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(isPrimary ? 200 : 120);
      doc.text(label.toUpperCase(), x + 4, cardY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(isPrimary ? 255 : 15);
      doc.text(value, x + 4, cardY + 14);
    };

    const closingValue = closingBalance === 0
      ? '0  Settled'
      : closingBalance > 0
        ? `${formatINRForPDF(closingBalance)}  DR`
        : `${formatINRForPDF(Math.abs(closingBalance))}  CR`;

    drawCard(margin, 'Total lent', formatINRForPDF(totalLent));
    drawCard(margin + cardW + 4, 'Total borrowed', formatINRForPDF(totalBorrowed));
    drawCard(margin + 2 * (cardW + 4), 'Net balance', closingValue, true);

    // --- Transaction table ---
    const tableStartY = cardY + cardH + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text('Transactions', margin, tableStartY - 3);

    // A4 portrait usable width = 182mm. Sum below = 182.
    autoTable(doc, {
      startY: tableStartY,
      margin: { left: margin, right: margin },
      head: [['Date', 'Description', 'Lent', 'Borrowed', 'Balance']],
      body: tableBody,
      styles: {
        fontSize: 9,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: [232, 234, 240],
        lineWidth: 0.15,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [80, 90, 110],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        lineColor: [220, 224, 232],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: [252, 253, 254] },
      columnStyles: {
        0: { cellWidth: 24 },                                       // Date
        1: { cellWidth: 70, overflow: 'linebreak' },                // Description
        2: { cellWidth: 28, halign: 'right' },                      // Lent
        3: { cellWidth: 28, halign: 'right' },                      // Borrowed
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },   // Balance + DR/CR
      },
    });

    // --- Closing balance footer ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? tableStartY;

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(margin, finalY + 6, pageW - margin, finalY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const closingLabel = closingBalance === 0
      ? 'Closing balance — Settled'
      : closingBalance > 0
        ? 'Closing balance — they owe you'
        : 'Closing balance — you owe them';
    doc.text(closingLabel, margin, finalY + 13);

    doc.setFontSize(13);
    doc.text(closingValue, pageW - margin, finalY + 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Legend
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(
      'All amounts in INR.  DR = receivable from counterparty (they owe you).  CR = payable to counterparty (you owe them).',
      margin,
      finalY + 21
    );
  }

  const safeName = (contactName || contactEmail).replace(/[^a-z0-9]/gi, '_');
  triggerDownload(doc.output('blob'), `loan-statement-${safeName}-${format(now, 'yyyyMMdd')}.pdf`);
}
