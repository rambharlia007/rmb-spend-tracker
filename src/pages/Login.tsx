import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { friendlyError } from '@/lib/errorMessages';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signIn();
    } catch (e: unknown) {
      // User cancelled popup → don't show error
      if ((e as { code?: string })?.code !== 'auth/popup-closed-by-user' && (e as { code?: string })?.code !== 'auth/cancelled-popup-request') {
        setError(friendlyError(e));
      }
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold">Spend Tracker</h1>
          <p className="text-muted-foreground mt-2">Track spends, loans, and more</p>
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-left">
            {error}
          </div>
        )}
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full rounded-md bg-primary px-4 py-3 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
        >
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
