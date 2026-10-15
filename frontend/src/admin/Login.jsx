import { useState } from 'react';
import { useNavigate } from 'react-router';
import { auth, publicApi } from '../api.js';
import './admin.css';

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token } = await publicApi('/auth/login', { method: 'POST', body: { password } });
      auth.set(token);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="a-root a-login">
      <form onSubmit={submit}>
        <div className="a-brand">AUTHENTIC8</div>
        <h1>Certificate issuing</h1>
        {error && <div className="a-alert">{error}</div>}
        <label className="a-field">
          <span>Admin password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" required />
        </label>
        <button className="a-btn primary big" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
