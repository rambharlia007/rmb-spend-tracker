import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { subscribeNotes, createNote, updateNote, deleteNote, type Note } from '@/lib/firestore/notes';
import { friendlyError } from '@/lib/errorMessages';
import { logError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { StickyNote, Plus, Pencil, Trash2 } from 'lucide-react';

type NoteForm = { title: string; body: string };
const EMPTY_FORM: NoteForm = { title: '', body: '' };

export default function Notes() {
  const { workspace } = useWorkspace();
  const { internalId } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState<NoteForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);

  const wsId = workspace?.id;

  useEffect(() => {
    if (!wsId || !internalId) return;
    return subscribeNotes(
      wsId,
      internalId,
      setNotes,
      (err) => {
        logError('Notes.subscribe', err);
        toast(friendlyError(err), 'error');
      }
    );
  }, [wsId, internalId]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setForm({ title: note.title, body: note.body });
    setOpen(true);
  }

  async function handleSave() {
    if (!wsId || !internalId) return;
    if (!form.title.trim() && !form.body.trim()) {
      toast('Add a title or body', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateNote(wsId, editing.id, form.title, form.body);
        toast('Note updated', 'success');
      } else {
        await createNote(wsId, internalId, form.title, form.body);
        toast('Note saved', 'success');
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
    } catch (e: unknown) {
      logError('Notes.save', e);
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!wsId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNote(wsId, deleteTarget.id);
      toast('Note deleted');
    } catch (e: unknown) {
      logError('Notes.delete', e);
      toast(friendlyError(e), 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground">Personal notes for this workspace.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> New Note
        </Button>
      </header>

      {notes === null ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          description="Jot down anything — ideas, reminders, references."
          action={<Button onClick={openNew}>Add note</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow"
            >
              {note.title && (
                <div className="font-semibold text-sm leading-snug">{note.title}</div>
              )}
              {note.body && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {note.body}
                </div>
              )}
              <div className="flex items-center justify-between mt-auto pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {note.updatedAt
                    ? format(note.updatedAt.toDate(), 'dd MMM yyyy HH:mm')
                    : '—'}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(note)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(note)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Note' : 'New Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Optional title"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write anything…"
                rows={8}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete note"
        description={`Delete "${deleteTarget?.title || 'this note'}"? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
