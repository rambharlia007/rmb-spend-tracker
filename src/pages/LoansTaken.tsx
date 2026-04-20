import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { subscribeLoansReceived, acceptLoan, disputeLoan } from '@/lib/firestore/loans';
import { formatINR } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownToLine, Check, AlertTriangle } from 'lucide-react';
import type { SharedLoan } from '@/types';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS: Record<string, string> = {
  unconfirmed: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  accepted: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  disputed: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  settled: 'text-green-600 bg-green-100 dark:bg-green-900/30',
};

export default function LoansTaken() {
  const { toast } = useToast();
  const { internalId } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<SharedLoan[] | null>(null);

  useEffect(() => {
    if (!internalId) return;
    return subscribeLoansReceived(internalId, setLoans);
  }, [internalId]);

  async function handleAccept(loanId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await acceptLoan(loanId);
      toast('Loan accepted', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleDispute(loanId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await disputeLoan(loanId);
      toast('Loan marked as disputed');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  const activeLoans = loans?.filter((l) => l.status !== 'settled') ?? [];
  const settledLoans = loans?.filter((l) => l.status === 'settled') ?? [];
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingAmount, 0);
  const pendingConfirmation = activeLoans.filter((l) => l.status === 'unconfirmed');

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Loans Taken</h1>
        <p className="text-sm text-muted-foreground">Money others lent to you.</p>
      </header>

      {/* Pending confirmation banner */}
      {pendingConfirmation.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {pendingConfirmation.length} loan{pendingConfirmation.length > 1 ? 's' : ''} awaiting your confirmation — review below.
        </div>
      )}

      {loans === null ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : loans.length === 0 ? (
        <EmptyState icon={ArrowDownToLine} title="No loans taken" description="When someone records a loan for you, it'll appear here." />
      ) : (
        <>
          {activeLoans.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Outstanding</h2>
                <span className="text-sm font-semibold tabular-nums">{formatINR(totalOutstanding)}</span>
              </div>
              <div className="space-y-2">
                {activeLoans.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border bg-card px-4 py-3 cursor-pointer"
                    onClick={() => navigate(`/loan/${l.id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{l.giverName || l.giverEmail}</div>
                      <div className="text-sm font-semibold tabular-nums shrink-0">{formatINR(l.outstandingAmount)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(l.date.toDate(), 'dd MMM yyyy')}{l.notes ? ` · ${l.notes}` : ''}
                    </div>
                    {l.outstandingAmount !== l.amount && (
                      <div className="text-xs text-muted-foreground">of {formatINR(l.amount)}</div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className={STATUS_COLORS[l.status]}>{l.status}</Badge>
                      {l.status === 'unconfirmed' && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" onClick={(e) => handleAccept(l.id, e)}>
                            <Check className="h-3 w-3 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => handleDispute(l.id, e)}>
                            <AlertTriangle className="h-3 w-3 mr-1" /> Dispute
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {settledLoans.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Settled</h2>
              <div className="space-y-2 opacity-60">
                {settledLoans.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => navigate(`/loan/${l.id}`)}
                    className="rounded-lg border bg-card px-4 py-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{l.giverName || l.giverEmail}</div>
                      <span className="text-sm tabular-nums shrink-0">{formatINR(l.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground">{format(l.date.toDate(), 'dd MMM yyyy')}</div>
                      <Badge variant="secondary" className={STATUS_COLORS[l.status]}>settled</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
