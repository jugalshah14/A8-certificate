import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { adminApi } from '../api.js';
import { ErrorBox, Field } from './ui.jsx';

function PhotoInput({ label, hint, file, onChange }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  return (
    <div className="a-field">
      <span>{label}</span>
      <div className="a-photo">
        {preview ? <img src={preview} alt="" /> : <span className="empty">No image</span>}
        <div className="a-row">
          <label className="a-btn small">
            {file ? 'Replace' : 'Choose image'}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onChange(e.target.files?.[0] || null)} />
          </label>
          {file && (
            <button type="button" className="a-btn small" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  const common = { value: value || '', onChange: (e) => onChange(e.target.value), required: field.required, placeholder: field.placeholder || undefined };
  if (field.type === 'textarea') return <textarea {...common} rows={4} maxLength={2000} />;
  if (field.type === 'select')
    return (
      <select {...common}>
        <option value="">Choose…</option>
        {field.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  if (field.type === 'date') return <input type="date" {...common} />;
  if (field.type === 'number') return <input type="number" {...common} />;
  return <input {...common} maxLength={200} />;
}

export default function Issue() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(params.get('event') || '');
  const [roleKey, setRoleKey] = useState('');
  const [name, setName] = useState('');
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({ photo: null, cardFront: null, cardBack: null });
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi('/events').then((list) => {
      setEvents(list);
      setEventId((current) => (list.some((e) => e.id === current) ? current : list[0]?.id || ''));
    }, setError);
  }, []);

  const event = events?.find((e) => e.id === eventId);
  const role = event?.roles.find((r) => r.key === roleKey);
  const fields = role && event ? (role.fields.length ? event.fields.filter((f) => role.fields.includes(f.key)) : event.fields) : [];

  useEffect(() => {
    if (event && !event.roles.some((r) => r.key === roleKey)) setRoleKey(event.roles[0]?.key || '');
  }, [event, roleKey]);

  const pickEvent = (id) => {
    setEventId(id);
    setValues({});
    setParams({ event: id }, { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      const shown = Object.fromEntries(fields.map((f) => [f.key, values[f.key] || '']));
      form.append('data', JSON.stringify({ eventId, roleKey, recipientName: name, values: shown, couponCode: coupon }));
      for (const [key, file] of Object.entries(files)) if (file) form.append(key, file);
      const cert = await adminApi('/certificates', { method: 'POST', form });
      navigate(`/admin/certificates/${cert.id}?issued=1`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (events && events.length === 0) {
    return (
      <main className="a-main a-narrow">
        <div className="a-card a-empty">Create an event first.</div>
      </main>
    );
  }

  return (
    <main className="a-main a-narrow">
      <form onSubmit={submit}>
        <div className="a-head">
          <div>
            <h1>Issue a certificate</h1>
            <p>Fill in the person's details. The certificate is recorded on the blockchain when you issue it.</p>
          </div>
        </div>
        <ErrorBox error={error} />

        <section className="a-card">
          <div className="a-grid two">
            <Field label="Event" required wide>
              <select value={eventId} onChange={(e) => pickEvent(e.target.value)} required>
                {events?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {event && (
            <div className="a-field" style={{ marginTop: 16 }}>
              <span>Certificate for</span>
              <div className="a-rolePick" role="group" aria-label="Role">
                {event.roles.map((r) => (
                  <button type="button" key={r.key} aria-pressed={r.key === roleKey} onClick={() => setRoleKey(r.key)}>
                    <span className={`a-tier ${r.tier}`} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {role && (
          <section className="a-card">
            <h2>{role.label}</h2>
            <p className="a-hint">{event.name}</p>
            <div className="a-grid two">
              <Field label="Full name" required wide>
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="off" placeholder="As it should appear on the certificate" />
              </Field>
              {fields.map((f) => (
                <Field key={f.key} label={f.label} required={f.required} wide={f.type === 'textarea'}>
                  <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                </Field>
              ))}
              {event.authSponsor && (
                <Field label="Coupon code" hint={`Leave empty to use ${event.authSponsor.code || 'no code'}`}>
                  <input value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
                </Field>
              )}
            </div>
          </section>
        )}

        {role && (
          <section className="a-card">
            <h2>Images</h2>
            <p className="a-hint">Optional. Images are fingerprinted with the certificate, so swapping one later is detected.</p>
            <div className="a-grid two">
              <PhotoInput label="Photo of the person" file={files.photo} onChange={(f) => setFiles((s) => ({ ...s, photo: f }))} />
              <PhotoInput label="Card front" file={files.cardFront} onChange={(f) => setFiles((s) => ({ ...s, cardFront: f }))} />
              <PhotoInput label="Card back" file={files.cardBack} onChange={(f) => setFiles((s) => ({ ...s, cardBack: f }))} />
            </div>
          </section>
        )}

        <div className="a-row">
          <span className="a-spacer" />
          <button className="a-btn primary big" disabled={busy || !role}>
            {busy ? 'Issuing and recording on blockchain…' : 'Issue certificate'}
          </button>
        </div>
      </form>
    </main>
  );
}
