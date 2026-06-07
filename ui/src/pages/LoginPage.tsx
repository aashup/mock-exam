import {useState} from 'react';
import {Navigate, useNavigate} from 'react-router-dom';
import {useAuth} from '@/auth/AuthContext';
import {Button} from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {errorMessage} from '@/api/client';

export function LoginPage() {
  const {login, isAdmin, loading: authLoading} = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already authenticated → skip the form (declarative redirect, not during-render navigate).
  if (!authLoading && isAdmin) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', {replace: true});
    } catch (err) {
      setError(errorMessage(err, 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Exam Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your admin account</p>
        </div>

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
