import { useState } from 'react';
import { adminApi } from '../api.js';

export function Field({ label, required, hint, wide, children }) {
  return (
    <label className={`a-field ${wide ? 'wide' : ''}`}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="a-alert" role="alert">
      {error.message}
      {error.problems?.length > 1 && (
        <ul>
          {error.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uploads an image to the media store and reports its URL. */
export function ImageInput({ label, value, onChange, hint }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await adminApi('/uploads', { method: 'POST', form });
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="a-field">
      <span>{label}</span>
      <div className="a-image">
        {value ? <img src={value} alt="" /> : <span className="empty">None</span>}
        <label className="a-btn small">
          {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={pick} disabled={busy} />
        </label>
        {value && (
          <button type="button" className="a-btn small" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
      {error && <small style={{ color: 'var(--bad)' }}>{error}</small>}
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** A list section with add, remove and reorder controls. */
export function Repeater({ items, onChange, make, title, addLabel, render }) {
  const set = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i, d) => {
    const next = items.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="a-items">
      {items.map((item, i) => (
        <div className="a-item" key={i}>
          <div className="a-itemHead">
            <span>{title(item, i)}</span>
            <span className="a-spacer" />
            <button type="button" className="a-iconBtn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="a-iconBtn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="a-iconBtn" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
          {render(item, (patch) => set(i, patch), i)}
        </div>
      ))}
      <div>
        <button type="button" className="a-btn small" onClick={() => onChange([...items, make()])}>
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export const CHAIN_STATUS = {
  anchored: ['ok', 'On blockchain'],
  pending: ['warn', 'Pending'],
};
