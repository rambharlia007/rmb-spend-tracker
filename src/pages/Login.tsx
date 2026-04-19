import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { user, loading, signIn } = useAuth();

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold">Spend Tracker</h1>
          <p className="text-muted-foreground mt-2">Track spends, loans, and more</p>
        </div>
        <button
          onClick={() => signIn().catch((e) => alert(e.message))}
          className="w-full rounded-md bg-primary px-4 py-3 text-primary-foreground font-medium hover:opacity-90"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
