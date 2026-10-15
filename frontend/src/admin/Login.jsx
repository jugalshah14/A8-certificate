import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { auth, publicApi } from '../api.js';
import './admin.css';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  let script = document.querySelector(`script[src="${GIS_SRC}"]`);
  if (!script) {
    script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    document.head.appendChild(script);
  }
  return new Promise((resolve, reject) => {
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')), { once: true });
  });
}

function GoogleButton({ clientId, onCredential }) {
  const el = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    loadGoogleScript()
      .then(() => {
        if (!alive || !el.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => onCredential(r.credential), ux_mode: 'popup' });
        window.google.accounts.id.renderButton(el.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 312 });
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [clientId, onCredential]);

  return (
    <>
      <div ref={el} style={{ minHeight: 44, display: 'flex', justifyContent: 'center' }} />
      {error && <small style={{ color: 'var(--bad)' }}>{error}</small>}
    </>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    publicApi('/auth/options').then(setOptions, () => setOptions({ googleClientId: null, passwordLogin: true }));
  }, []);

  const finish = ({ token }) => {
    auth.set(token);
    navigate('/admin', { replace: true });
  };

  const onCredential = useRef(async (credential) => {
    setBusy(true);
    setError('');
    try {
      finish(await publicApi('/auth/google', { method: 'POST', body: { credential } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }).current;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      finish(await publicApi('/auth/login', { method: 'POST', body: { password } }));
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
        <p className="a-hint" style={{ margin: 0 }}>
          Sign in with the Google account your admin added to the team.
        </p>
        {error && (
          <div className="a-alert" role="alert" style={{ margin: 0 }}>
            {error}
          </div>
        )}
        {options?.googleClientId ? (
          <GoogleButton clientId={options.googleClientId} onCredential={onCredential} />
        ) : (
          options && <div className="a-alert warn" style={{ margin: 0 }}>Google sign-in is not set up yet. Set GOOGLE_CLIENT_ID in the backend .env.</div>
        )}
        {options?.passwordLogin && (
          <>
            <div className="a-or">
              <span>or admin password</span>
            </div>
            <label className="a-field">
              <span>Admin password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            <button className="a-btn primary big" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
