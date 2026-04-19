import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function BackupSettings() {
  const { workspaceId, workspace } = useWorkspace();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  async function handleJSONExport() {
    if (!workspaceId) return;
    setExporting(true);
    try {
      const [spends, cats, sources] = await Promise.all([
        getDocs(collection(db, 'workspaces', workspaceId, 'spends')),
        getDocs(collection(db, 'workspaces', workspaceId, 'categories')),
        getDocs(collection(db, 'workspaces', workspaceId, 'paymentSources')),
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        workspace: { id: workspaceId, name: workspace?.name },
        spends: spends.docs.map((d) => ({ id: d.id, ...d.data() })),
        categories: cats.docs.map((d) => ({ id: d.id, ...d.data() })),
        paymentSources: sources.docs.map((d) => ({ id: d.id, ...d.data() })),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spend-tracker-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  }

  function handleClearCache() {
    indexedDB.databases?.().then((dbs) => {
      dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
    });
    toast('IndexedDB cache cleared. Reload to reconnect.');
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Backup & Data</h1>
        <p className="text-sm text-muted-foreground">Export or manage your data.</p>
      </header>

      <div className="rounded-lg border p-4 bg-card space-y-3">
        <h2 className="text-sm font-semibold">Export Data</h2>
        <p className="text-xs text-muted-foreground">Download all spends, categories, and payment sources as JSON.</p>
        <Button onClick={handleJSONExport} disabled={exporting} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting…' : 'Download JSON Backup'}
        </Button>
      </div>

      <div className="rounded-lg border p-4 bg-card space-y-3">
        <h2 className="text-sm font-semibold">Yearly PDF Report</h2>
        <p className="text-xs text-muted-foreground">Export a full year's report with monthly totals and category breakdown. Go to Spends page and use the export button with a custom date range.</p>
        <Link to="/spends" className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <FileText className="h-4 w-4" /> Go to Spends
        </Link>
      </div>

      <div className="rounded-lg border border-destructive/30 p-4 bg-card space-y-3">
        <h2 className="text-sm font-semibold text-destructive">Clear Offline Cache</h2>
        <p className="text-xs text-muted-foreground">Clears the local IndexedDB Firestore cache. Useful if you see stale data. You'll need to reload after clearing.</p>
        <Button variant="destructive" size="sm" onClick={handleClearCache}>
          <Trash2 className="h-4 w-4 mr-2" /> Clear Cache
        </Button>
      </div>
    </div>
  );
}
