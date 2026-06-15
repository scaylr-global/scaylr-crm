import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field } from '../components/ui';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@scaylr.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate('/', { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-8">
          <Zap size={28} className="text-teal" />
          Scaylr <span className="text-teal">CRM</span>
        </div>
        <form onSubmit={submit} className="card p-6">
          <h1 className="text-lg font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-muted mb-5">Sign in to your sales workspace</p>

          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus />
          </Field>
          <Field label="Password">
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </Field>

          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-teal w-full mt-2 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-5 text-xs text-muted border-t border-border pt-4">
            <div className="font-medium text-slate-300 mb-1">Demo accounts</div>
            admin@scaylr.com · admin123
            <br />
            maya@scaylr.com · manager123
            <br />
            evan@scaylr.com · employee123
          </div>
        </form>
      </div>
    </div>
  );
}
