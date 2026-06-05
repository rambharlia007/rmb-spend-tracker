import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { subscribeLoansGiven, subscribeLoansReceived, subscribeRepayments, type Repayment } from '@/lib/firestore/loans';
import { generateLoanStatementPDF } from '@/lib/export/exporter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatINR } from '@/lib/utils';
import { ArrowLeft, FileDown } from 'lucide-react';
import type { Contact, SharedLoan } from '@/types';

type LedgerEntry = {
  key: string;
  date: Date;
  description: string;
  signedAmount: number; // +ve = they owe me more, -ve = I owe them more
  loanId: string;
  loanStatus: SharedLoan['status'];
  type: 'loan-given' | 'loan-taken' | 'repayment-in' | 'repayment-out' | 'settlement-legacy';
};

const TYPE_LABEL: Record<LedgerEntry['type'], string> = {
  'loan-given': 'Loan given',
  'loan-taken': 'Loan taken',
  'repayment-in': 'Repayment received',
  'repayment-out': 'Repayment paid',
  'settlement-legacy': 'Settlement',
};

const TERMINAL_STATUSES: SharedLoan['status'][] = ['settled', 'closed', 'disputed'];

export default function ContactStatement() {
  const { contactId } = useParams<{ contactId: string }>();
  const { internalId, user } = useAuth();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null | 'loading'>('loading');
  const [loansGiven, setLoansGiven] = useState<SharedLoan[]>([]);
  const [loansReceived, setLoansReceived] = useState<SharedLoan[]>([]);
  const [repaymentsByLoan, setRepaymentsByLoan] = useState<Record<string, Repayment[]>>({});

  // Subscribe to the contact doc
  useEffect(() => {
    if (!internalId || !contactId) return;
    const unsub = onSnapshot(
      doc(db, 'users', internalId, 'contacts', contactId),
      (snap) => {
        if (!snap.exists()) { setContact(null); return; }
        setContact({ id: snap.id, ...(snap.data() as Omit<Contact, 'id'>) });
      },
      () => setContact(null)
    );
    return unsub;
  }, [internalId, contactId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansGiven(internalId, setLoansGiven);
  }, [internalId]);

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansReceived(internalId, setLoansReceived);
  }, [internalId]);

  // Filter to loans that involve this contact
  const contactLoans = useMemo(() => {
    if (!contact || contact === 'loading' || !contact.refUserId) {
      return { given: [] as SharedLoan[], taken: [] as SharedLoan[], all: [] as SharedLoan[] };
    }
    const given = loansGiven.filter((l) => l.receiverInternalId === contact.refUserId);
    const taken = loansReceived.filter((l) => l.giverInternalId === contact.refUserId);
    return { given, taken, all: [...given, ...taken] };
  }, [contact, loansGiven, loansReceived]);

  // Subscribe to repayments for every involved loan
  useEffect(() => {
    const ids = contactLoans.all.map((l) => l.id);
    if (ids.length === 0) { setRepaymentsByLoan({}); return; }

    const unsubs = ids.map((id) =>
      subscribeRepayments(id, (reps) => {
        setRepaymentsByLoan((prev) => ({ ...prev, [id]: reps }));
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [contactLoans.all.map((l) => l.id).join('|')]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Build ledger entries with running balance
  const { entries, totals } = useMemo(() => {
    const events: LedgerEntry[] = [];

    // Compute the "settlement gap" for legacy data: loans terminated before the
    // settleLoan-writes-a-repayment change have status=settled/closed but no
    // repayment record covering the full principal. Synthesize a dated entry
    // using updatedAt so the running balance still zeroes out correctly.
    // For new data this gap is 0, so nothing is synthesized.
    const legacyGap = (l: SharedLoan): number => {
      if (!TERMINAL_STATUSES.includes(l.status)) return 0;
      const paid = (repaymentsByLoan[l.id] ?? []).reduce((s, r) => s + r.amount, 0);
      const gap = Math.round((l.amount - paid) * 100) / 100;
      return gap > 0 ? gap : 0;
    };

    for (const l of contactLoans.given) {
      events.push({
        key: `loan-g-${l.id}`,
        date: l.date.toDate(),
        description: l.notes ? `Lent · ${l.notes}` : 'Lent',
        signedAmount: l.amount,
        loanId: l.id,
        loanStatus: l.status,
        type: 'loan-given',
      });
      for (const r of repaymentsByLoan[l.id] ?? []) {
        events.push({
          key: `rep-g-${l.id}-${r.id}`,
          date: r.date.toDate(),
          description: r.notes ? `Repayment received · ${r.notes}` : 'Repayment received',
          signedAmount: -r.amount,
          loanId: l.id,
          loanStatus: l.status,
          type: 'repayment-in',
        });
      }
      const gap = legacyGap(l);
      if (gap > 0) {
        events.push({
          key: `settle-g-${l.id}`,
          date: l.updatedAt?.toDate?.() ?? l.date.toDate(),
          description: l.status === 'settled' ? 'Settlement (legacy record)' : 'Closed (legacy record)',
          signedAmount: -gap,
          loanId: l.id,
          loanStatus: l.status,
          type: 'settlement-legacy',
        });
      }
    }

    for (const l of contactLoans.taken) {
      events.push({
        key: `loan-t-${l.id}`,
        date: l.date.toDate(),
        description: l.notes ? `Borrowed · ${l.notes}` : 'Borrowed',
        signedAmount: -l.amount,
        loanId: l.id,
        loanStatus: l.status,
        type: 'loan-taken',
      });
      for (const r of repaymentsByLoan[l.id] ?? []) {
        events.push({
          key: `rep-t-${l.id}-${r.id}`,
          date: r.date.toDate(),
          description: r.notes ? `Repayment paid · ${r.notes}` : 'Repayment paid',
          signedAmount: r.amount,
          loanId: l.id,
          loanStatus: l.status,
          type: 'repayment-out',
        });
      }
      const gap = legacyGap(l);
      if (gap > 0) {
        events.push({
          key: `settle-t-${l.id}`,
          date: l.updatedAt?.toDate?.() ?? l.date.toDate(),
          description: l.status === 'settled' ? 'Settlement (legacy record)' : 'Closed (legacy record)',
          signedAmount: gap,
          loanId: l.id,
          loanStatus: l.status,
          type: 'settlement-legacy',
        });
      }
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = 0;
    const withBalance = events.map((e) => {
      running = Math.round((running + e.signedAmount) * 100) / 100;
      return { ...e, runningBalance: running };
    });

    const totalLent = contactLoans.given.reduce((s, l) => s + l.amount, 0);
    const totalBorrowed = contactLoans.taken.reduce((s, l) => s + l.amount, 0);
    // Counted-back totals include the legacy settlement gap so they reconcile
    // with the principal column for old data (where no repayment doc exists).
    const totalReceivedBack = contactLoans.given.reduce(
      (s, l) => s + (repaymentsByLoan[l.id] ?? []).reduce((rs, r) => rs + r.amount, 0) + legacyGap(l),
      0
    );
    const totalPaidBack = contactLoans.taken.reduce(
      (s, l) => s + (repaymentsByLoan[l.id] ?? []).reduce((rs, r) => rs + r.amount, 0) + legacyGap(l),
      0
    );

    return {
      entries: withBalance,
      totals: {
        totalLent,
        totalBorrowed,
        totalReceivedBack,
        totalPaidBack,
        netOutstanding: running,
      },
    };
  }, [contactLoans, repaymentsByLoan]);

  function handleDownloadPDF() {
    if (!contact || contact === 'loading' || !user) return;
    generateLoanStatementPDF({
      myName: user.displayName || user.email || 'Me',
      contactName: contact.displayName || contact.email,
      contactEmail: contact.email,
      givenLoans: contactLoans.given,
      takenLoans: contactLoans.taken,
      fromDate: null,
      toDate: null,
    });
  }

  if (contact === 'loading') {
    return <div className="p-6 max-w-3xl mx-auto space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }
  if (!contact) {
    return <div className="p-6 text-destructive">Contact not found.</div>;
  }

  const netLabel =
    totals.netOutstanding > 0
      ? `They owe you ${formatINR(totals.netOutstanding)}`
      : totals.netOutstanding < 0
        ? `You owe them ${formatINR(Math.abs(totals.netOutstanding))}`
        : 'All settled';
  const netColor =
    totals.netOutstanding > 0 ? 'text-green-600' :
    totals.netOutstanding < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Statement with</div>
            <div className="text-lg font-semibold truncate">{contact.displayName || contact.email}</div>
            <div className="text-xs text-muted-foreground truncate">{contact.email}</div>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={entries.length === 0}>
            <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground">Net outstanding</div>
          <div className={`text-2xl font-bold tabular-nums ${netColor}`}>{netLabel}</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Summary label="Total lent" value={totals.totalLent} />
          <Summary label="Received back" value={totals.totalReceivedBack} />
          <Summary label="Total borrowed" value={totals.totalBorrowed} />
          <Summary label="Paid back" value={totals.totalPaidBack} />
        </div>
      </div>

      {/* Ledger */}
      {!contact.refUserId ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          This contact hasn't connected on the app yet — no shared loans to show.
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          No transactions with this contact yet.
        </div>
      ) : (
        <section>
          <h2 className="text-sm font-semibold mb-2">Transactions</h2>
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[90px_1fr_110px_110px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
            <div>Date</div>
            <div>Description</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Balance</div>
          </div>
          <div className="divide-y rounded-lg border overflow-hidden">
            {entries.map((e) => {
              const isTerminal = e.loanStatus === 'settled' || e.loanStatus === 'closed' || e.loanStatus === 'disputed';
              const amtColor = e.signedAmount > 0 ? 'text-green-600' : 'text-red-500';
              const balColor =
                e.runningBalance > 0 ? 'text-green-600' :
                e.runningBalance < 0 ? 'text-red-500' : 'text-muted-foreground';
              return (
                <button
                  key={e.key}
                  onClick={() => navigate(`/loan/${e.loanId}`)}
                  className={`w-full text-left bg-card hover:bg-muted/40 transition px-3 py-2.5 grid grid-cols-2 sm:grid-cols-[90px_1fr_110px_110px] gap-x-2 gap-y-1 items-center ${isTerminal ? 'opacity-60' : ''}`}
                >
                  <div className="text-xs text-muted-foreground sm:text-sm sm:text-foreground tabular-nums">
                    {format(e.date, 'dd MMM yy')}
                  </div>
                  <div className="text-sm truncate order-first sm:order-none col-span-2 sm:col-span-1">
                    <span>{e.description}</span>
                    {' '}
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 align-middle">{TYPE_LABEL[e.type]}</Badge>
                  </div>
                  <div className={`text-sm font-medium tabular-nums text-right ${amtColor}`}>
                    {e.signedAmount > 0 ? '+' : '−'}{formatINR(Math.abs(e.signedAmount))}
                  </div>
                  <div className={`text-sm font-semibold tabular-nums text-right ${balColor}`}>
                    {formatINR(Math.abs(e.runningBalance))}
                    {e.runningBalance !== 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1">{e.runningBalance > 0 ? 'DR' : 'CR'}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            DR = they owe you · CR = you owe them. Tap a row to open the loan.
          </p>
        </section>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{formatINR(value)}</div>
    </div>
  );
}
