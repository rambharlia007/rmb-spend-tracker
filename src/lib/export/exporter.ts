import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Category, PaymentSource, Spend } from '@/types';
import { formatINR } from '@/lib/utils';
import type { FilterState } from '@/components/FilterBar';
import { PRESET_LABELS } from '@/lib/dateRanges';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
    body: summary.map(([name, amt]) => [name, formatINR(amt), ((amt / total) * 100).toFixed(1) + '%']),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
  });

  doc.save(`spends-${format(now, 'yyyyMMdd-HHmm')}.pdf`);
}
