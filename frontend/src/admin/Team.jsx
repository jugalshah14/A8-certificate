import { useEffect, useState } from 'react';
import { adminApi } from '../api.js';
import { useMeta } from './AdminLayout.jsx';
import { ErrorBox, Field, formatDate } from './ui.jsx';

const ROLE_INFO = {
  admin: 'Everything: events, team, issuing, revoking.',
  employee: 'Issue certificates, view them, print QR codes and write NFC cards.',
};

function AddPerson({ onAdded, onCancel }) {
  const [form, setForm] = useState({ email: '', name: '', role: 'employee' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await adminApi('/users', { method: 'POST', body: form }));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <form className="a-card" onSubmit={submit}>
      <h2>Add a person</h2>
      <p className="a-hint">They sign in with the Google account for this email.</p>
      <ErrorBox error={error} />
      <div className="a-grid two">
        <Field label="Google email" required>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus placeholder="name@company.com" />
        </Field>
        <Field label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      </div>
      <div className="a-field" style={{ marginTop: 14 }}>
        <span>Role</span>
        <div className="a-rolePick" role="group" aria-label="Role">
          {['employee', 'admin'].map((r) => (
            <button type="button" key={r} aria-pressed={form.role === r} onClick={() => setForm({ ...form, role: r })}>
              {r === 'admin' ? 'Admin' : 'Employee'}
            </button>
          ))}
        </div>
        <small>{ROLE_INFO[form.role]}</small>
      </div>
      <div className="a-row" style={{ marginTop: 18 }}>
        <span className="a-spacer" />
        <button type="button" className="a-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="a-btn primary" disabled={busy}>
          {busy ? 'Adding…' : `Add ${form.role === 'admin' ? 'admin' : 'employee'}`}
        </button>
      </div>
    </form>
  );
}

export default function Team() {
  const meta = useMeta();
  const [users, setUsers] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const load = () => adminApi('/users').then(setUsers, setError);
  useEffect(() => {
    load();
  }, []);

  const change = async (user, patch) => {
    setError(null);
    try {
      await adminApi(`/users/${user.id}`, { method: 'PATCH', body: patch });
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const remove = async (user) => {
    if (!window.confirm(`Remove ${user.name || user.email} from the team? They will be signed out.`)) return;
    setError(null);
    try {
      await adminApi(`/users/${user.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err);
    }
  };

  const me = meta?.user;

  return (
    <main className="a-main">
      <div className="a-head">
        <div>
          <h1>Team</h1>
          <p>Admins and employees who can sign in with Google.</p>
        </div>
        {!adding && (
          <button type="button" className="a-btn primary" onClick={() => setAdding(true)}>
            + Add person
          </button>
        )}
      </div>
      {adding && (
        <AddPerson
          onCancel={() => setAdding(false)}
          onAdded={(u) => {
            setAdding(false);
            setNotice(`Added ${u.email} as ${u.role}.`);
            load();
          }}
        />
      )}
      {notice && <div className="a-alert ok">{notice}</div>}
      <ErrorBox error={error} />

      <div className="a-tableWrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const self = me?.id === u.id;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="a-person">
                      {u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" /> : <span className="a-avatar">{(u.name || u.email)[0].toUpperCase()}</span>}
                      <span>
                        <b>{u.name || u.email.split('@')[0]}</b>
                        {self && <span className="a-pill" style={{ marginLeft: 8 }}>You</span>}
                        <br />
                        <small>{u.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <select value={u.role} onChange={(e) => change(u, { role: e.target.value })} disabled={self} aria-label={`Role for ${u.email}`} style={{ width: 'auto' }}>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.active ? u.lastLoginAt ? <span className="a-pill ok">Active</span> : <span className="a-pill warn">Not signed in yet</span> : <span className="a-pill bad">Turned off</span>}</td>
                  <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</td>
                  <td>
                    {!self && (
                      <div className="a-row" style={{ flexWrap: 'nowrap' }}>
                        <button type="button" className="a-btn small" onClick={() => change(u, { active: !u.active })}>
                          {u.active ? 'Turn off' : 'Turn on'}
                        </button>
                        <button type="button" className="a-btn small danger" onClick={() => remove(u)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users?.length === 0 && <div className="a-empty">Nobody yet. Add yourself first so you can sign in with Google.</div>}
      </div>
      {me?.builtIn && (
        <p className="a-hint" style={{ marginTop: 14 }}>
          You are signed in with the admin password. Once your own Google account is on the team as an admin, you can turn password sign-in off by leaving
          ADMIN_PASSWORD empty.
        </p>
      )}
    </main>
  );
}
