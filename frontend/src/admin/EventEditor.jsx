import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { adminApi } from '../api.js';
import { useMeta } from './AdminLayout.jsx';
import { ErrorBox, Field, ImageInput, Repeater, slugify } from './ui.jsx';

const TIER_LABELS = { gold: 'Gold (winner)', silver: 'Silver (1st runner-up)', bronze: 'Bronze (2nd runner-up)', rose: 'Event colour (no rank)' };
const DISPLAY_LABELS = { fact: 'Details grid', moment: 'Quote card', hidden: 'Not shown (record only)' };
const TYPE_LABELS = { text: 'Short text', textarea: 'Long text', select: 'Choice list', date: 'Date', number: 'Number' };

const BLANK = {
  name: '',
  city: '',
  round: '',
  date: '',
  venue: '',
  theme: {
    primary: '#1a2a5e',
    primaryDeep: '#101a3d',
    accent: '#f26a21',
    accentSoft: '#fdba74',
    ink: '#1b2033',
    surface: '#fff1e3',
    surfaceSoft: '#fff8f1',
    headingFont: 'Noto Sans',
  },
  images: { emblem: '', hero: '', footer: '' },
  roles: [
    { key: 'winner', label: 'Winner', tier: 'gold', tagline: '', kind: '', resultLabel: 'Result', detailsTitle: 'Winner & Event Details', momentTitle: 'The Winning Moment', fields: [] },
    { key: 'participant', label: 'Participant', tier: 'rose', tagline: '', kind: '', resultLabel: 'Role', detailsTitle: '', momentTitle: '', fields: [] },
  ],
  fields: [],
  authSponsor: null,
  sponsors: [],
  partners: [],
  officials: { title: 'Officials', people: [] },
};

const newRole = () => ({ key: '', label: '', tier: 'rose', tagline: '', kind: '', resultLabel: 'Role', detailsTitle: '', momentTitle: '', fields: [] });
const newField = () => ({ key: '', label: '', type: 'text', display: 'fact', required: false, options: [], placeholder: '', _optionsText: '' });

// Editor-only state: options are edited as text, one per line.
function toEditor(event) {
  const { id, createdAt, updatedAt, certificateCount, ...rest } = event;
  return { ...rest, fields: rest.fields.map((f) => ({ ...f, _optionsText: (f.options || []).join('\n') })) };
}

function toPayload(draft) {
  return {
    ...draft,
    fields: draft.fields.map(({ _optionsText, ...f }) => ({
      ...f,
      options: f.type === 'select' ? _optionsText.split('\n').map((s) => s.trim()).filter(Boolean) : [],
    })),
  };
}

// Keep a key in step with its label until someone edits the key by hand.
function withLabel(item, label) {
  const follow = !item.key || item.key === slugify(item.label);
  return { label, ...(follow ? { key: slugify(label) } : {}) };
}

export default function EventEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const navigate = useNavigate();
  const meta = useMeta();
  const [draft, setDraft] = useState(id || from ? null : toEditor(BLANK));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const source = id || from;
    if (!source) return;
    adminApi(`/events/${source}`).then((e) => {
      const d = toEditor(e);
      if (from) d.name = `${d.name} (copy)`;
      setDraft(d);
    }, setError);
  }, [id, from]);

  if (!draft) {
    return (
      <main className="a-main a-narrow">
        <ErrorBox error={error} />
      </main>
    );
  }

  const set = (patch) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setTheme = (patch) => set({ theme: { ...draft.theme, ...patch } });
  const setImages = (patch) => set({ images: { ...draft.images, ...patch } });
  const setSponsor = (patch) => set({ authSponsor: { ...draft.authSponsor, ...patch } });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = toPayload(draft);
      const result = id ? await adminApi(`/events/${id}`, { method: 'PUT', body }) : await adminApi('/events', { method: 'POST', body });
      if (id) {
        setDraft(toEditor(result));
        setSaved(true);
      } else navigate(`/admin/events/${result.id}`, { replace: true });
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const colors = [
    ['primary', 'Main colour', 'Header bar, award panel, buttons'],
    ['primaryDeep', 'Main colour, dark', 'Header edges, hover'],
    ['accent', 'Accent', 'Stripes, highlights, share button'],
    ['accentSoft', 'Accent, light', 'Small labels on dark'],
    ['ink', 'Text', ''],
    ['surface', 'Background tint', 'Hero background'],
    ['surfaceSoft', 'Background tint, light', 'Cards'],
  ];

  return (
    <main className="a-main a-narrow">
      <form onSubmit={save}>
        <div className="a-head">
          <div>
            <h1>{id ? 'Edit event' : 'New event'}</h1>
            <p>Certificates already issued keep the names, dates and details they were issued with.</p>
          </div>
          <div className="a-row">
            <Link to="/admin" className="a-btn">
              Cancel
            </Link>
            <button className="a-btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save event'}
            </button>
          </div>
        </div>
        <ErrorBox error={error} />
        {saved && <div className="a-alert ok">Saved.</div>}

        <section className="a-card">
          <h2>Event</h2>
          <p className="a-hint">Shown on every certificate of this event.</p>
          <div className="a-grid two">
            <Field label="Event name" required wide>
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} required placeholder="e.g. Gujarat Kabaddi Championship 2026" />
            </Field>
            <Field label="Round or stage">
              <input value={draft.round} onChange={(e) => set({ round: e.target.value })} placeholder="e.g. State Final" />
            </Field>
            <Field label="Date" hint="As it should read on the certificate">
              <input value={draft.date} onChange={(e) => set({ date: e.target.value })} placeholder="e.g. 15 Nov 2026" />
            </Field>
            <Field label="Venue">
              <input value={draft.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="e.g. EKA Arena, Ahmedabad" />
            </Field>
            <Field label="City">
              <input value={draft.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="a-card">
          <h2>Look</h2>
          <p className="a-hint">Colours and images for the certificate page.</p>
          <div className="a-grid">
            {colors.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint}>
                <span className="a-color">
                  <input type="color" value={draft.theme[key]} onChange={(e) => setTheme({ [key]: e.target.value })} />
                  <input value={draft.theme[key]} onChange={(e) => setTheme({ [key]: e.target.value })} aria-label={`${label} hex`} />
                </span>
              </Field>
            ))}
            <Field label="Heading style">
              <select value={draft.theme.headingFont} onChange={(e) => setTheme({ headingFont: e.target.value })}>
                {(meta?.headingFonts || ['Oswald', 'Noto Sans']).map((f) => (
                  <option key={f} value={f}>
                    {f === 'Oswald' ? 'Oswald (condensed, sporty)' : `${f} (classic)`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="a-grid" style={{ marginTop: 16 }}>
            <ImageInput label="Emblem / logo" value={draft.images.emblem} onChange={(v) => setImages({ emblem: v })} />
            <ImageInput label="Hero artwork" value={draft.images.hero} onChange={(v) => setImages({ hero: v })} hint="Wide image behind the top" />
            <ImageInput label="Footer artwork" value={draft.images.footer} onChange={(v) => setImages({ footer: v })} />
          </div>
        </section>

        <section className="a-card">
          <h2>Form fields</h2>
          <p className="a-hint">What the issue form asks for, beyond the person's name and photo. These differ for every event.</p>
          <Repeater
            items={draft.fields}
            onChange={(fields) => set({ fields })}
            make={newField}
            addLabel="Add field"
            title={(f, i) => f.label || `Field ${i + 1}`}
            render={(f, update) => (
              <div className="a-grid">
                <Field label="Label" required>
                  <input value={f.label} onChange={(e) => update(withLabel(f, e.target.value))} placeholder="e.g. Category" />
                </Field>
                <Field label="Key" required hint="Stored with the certificate">
                  <input value={f.key} onChange={(e) => update({ key: e.target.value })} />
                </Field>
                <Field label="Type">
                  <select value={f.type} onChange={(e) => update({ type: e.target.value })}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Shown on certificate as">
                  <select value={f.display} onChange={(e) => update({ display: e.target.value })}>
                    {Object.entries(DISPLAY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                {f.type === 'select' && (
                  <Field label="Options" hint="One per line" wide>
                    <textarea value={f._optionsText} onChange={(e) => update({ _optionsText: e.target.value })} rows={4} />
                  </Field>
                )}
                <Field label="Placeholder" wide>
                  <input value={f.placeholder} onChange={(e) => update({ placeholder: e.target.value })} />
                </Field>
                <label className="a-check">
                  <input type="checkbox" checked={f.required} onChange={(e) => update({ required: e.target.checked })} />
                  Required
                </label>
              </div>
            )}
          />
        </section>

        <section className="a-card">
          <h2>Who receives a certificate</h2>
          <p className="a-hint">One role per kind of certificate: winners, participants, officials, volunteers…</p>
          <Repeater
            items={draft.roles}
            onChange={(roles) => set({ roles })}
            make={newRole}
            addLabel="Add role"
            title={(r, i) => r.label || `Role ${i + 1}`}
            render={(r, update) => (
              <>
                <div className="a-grid">
                  <Field label="Name" required>
                    <input value={r.label} onChange={(e) => update(withLabel(r, e.target.value))} placeholder="e.g. Winner" />
                  </Field>
                  <Field label="Key" required>
                    <input value={r.key} onChange={(e) => update({ key: e.target.value })} />
                  </Field>
                  <Field label="Finish">
                    <select value={r.tier} onChange={(e) => update({ tier: e.target.value })}>
                      {Object.entries(TIER_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Result label" hint={`"Result" for ranks, "Role" otherwise`}>
                    <input value={r.resultLabel} onChange={(e) => update({ resultLabel: e.target.value })} />
                  </Field>
                  <Field label="Tagline" wide>
                    <input value={r.tagline} onChange={(e) => update({ tagline: e.target.value })} placeholder="e.g. One raid stood above the rest." />
                  </Field>
                  <Field label="Subtitle" hint={`Default: "${r.label || 'Role'} · Physical Certificate"`}>
                    <input value={r.kind} onChange={(e) => update({ kind: e.target.value })} />
                  </Field>
                  <Field label="Details heading">
                    <input value={r.detailsTitle} onChange={(e) => update({ detailsTitle: e.target.value })} placeholder="Certificate & Event Details" />
                  </Field>
                  <Field label="Quote heading">
                    <input value={r.momentTitle} onChange={(e) => update({ momentTitle: e.target.value })} placeholder="Their Moment" />
                  </Field>
                </div>
                {draft.fields.length > 0 && (
                  <div className="a-field" style={{ marginTop: 14 }}>
                    <span>Fields to ask</span>
                    <div className="a-chips">
                      {draft.fields.map((f) => (
                        <label className="a-check" key={f.key || f.label}>
                          <input
                            type="checkbox"
                            checked={r.fields.length === 0 || r.fields.includes(f.key)}
                            onChange={(e) => {
                              const all = draft.fields.map((x) => x.key);
                              const current = r.fields.length ? r.fields : all;
                              const next = e.target.checked ? [...current, f.key] : current.filter((k) => k !== f.key);
                              update({ fields: next.length === all.length ? [] : next });
                            }}
                          />
                          {f.label || f.key}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          />
        </section>

        <section className="a-card">
          <h2>Authentication sponsor</h2>
          <p className="a-hint">Optional. Appears in the header and offers certificate holders a gift.</p>
          <label className="a-check">
            <input
              type="checkbox"
              checked={Boolean(draft.authSponsor)}
              onChange={(e) => set({ authSponsor: e.target.checked ? { name: '', logo: '', url: '', offer: '', terms: '', validTill: '', code: '', cta: '', banner: '' } : null })}
            />
            This event has an authentication sponsor
          </label>
          {draft.authSponsor && (
            <div className="a-grid" style={{ marginTop: 14 }}>
              <Field label="Name" required>
                <input value={draft.authSponsor.name} onChange={(e) => setSponsor({ name: e.target.value })} required />
              </Field>
              <Field label="Website">
                <input value={draft.authSponsor.url} onChange={(e) => setSponsor({ url: e.target.value })} placeholder="https://" />
              </Field>
              <Field label="Offer">
                <input value={draft.authSponsor.offer} onChange={(e) => setSponsor({ offer: e.target.value })} placeholder="e.g. ₹1,000 off" />
              </Field>
              <Field label="Terms">
                <input value={draft.authSponsor.terms} onChange={(e) => setSponsor({ terms: e.target.value })} />
              </Field>
              <Field label="Valid till">
                <input value={draft.authSponsor.validTill} onChange={(e) => setSponsor({ validTill: e.target.value })} />
              </Field>
              <Field label="Default coupon code" hint="Can be changed per certificate">
                <input value={draft.authSponsor.code} onChange={(e) => setSponsor({ code: e.target.value })} />
              </Field>
              <Field label="Button text">
                <input value={draft.authSponsor.cta} onChange={(e) => setSponsor({ cta: e.target.value })} />
              </Field>
              <ImageInput label="Logo" value={draft.authSponsor.logo} onChange={(v) => setSponsor({ logo: v })} />
              <ImageInput label="Banner image" value={draft.authSponsor.banner} onChange={(v) => setSponsor({ banner: v })} />
            </div>
          )}
        </section>

        <section className="a-card">
          <h2>Sponsors and organisers</h2>
          <Repeater
            items={draft.sponsors}
            onChange={(sponsors) => set({ sponsors })}
            make={() => ({ tag: 'Sponsor', name: '', logo: '', text: '', url: '', cta: '' })}
            addLabel="Add sponsor"
            title={(s, i) => s.name || `Sponsor ${i + 1}`}
            render={(s, update) => (
              <div className="a-grid">
                <Field label="Name" required>
                  <input value={s.name} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field label="Label" hint="e.g. Sponsor, Organiser">
                  <input value={s.tag} onChange={(e) => update({ tag: e.target.value })} />
                </Field>
                <Field label="Website">
                  <input value={s.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://" />
                </Field>
                <Field label="Button text">
                  <input value={s.cta} onChange={(e) => update({ cta: e.target.value })} />
                </Field>
                <Field label="Text" wide>
                  <textarea value={s.text} onChange={(e) => update({ text: e.target.value })} rows={2} />
                </Field>
                <ImageInput label="Logo" value={s.logo} onChange={(v) => update({ logo: v })} />
              </div>
            )}
          />
        </section>

        <section className="a-card">
          <h2>Partner logos</h2>
          <p className="a-hint">A strip of logos. Authentic8 is added automatically.</p>
          <Repeater
            items={draft.partners}
            onChange={(partners) => set({ partners })}
            make={() => ({ label: '', name: '', logo: '' })}
            addLabel="Add partner"
            title={(p, i) => p.name || `Partner ${i + 1}`}
            render={(p, update) => (
              <div className="a-grid">
                <Field label="Name" required>
                  <input value={p.name} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field label="Label" hint="e.g. Venue Partner">
                  <input value={p.label} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <ImageInput label="Logo" value={p.logo} onChange={(v) => update({ logo: v })} />
              </div>
            )}
          />
        </section>

        <section className="a-card">
          <h2>Officials</h2>
          <p className="a-hint">Referees, judges or jury shown on every certificate. Leave empty to hide the section.</p>
          <Field label="Section heading">
            <input value={draft.officials.title} onChange={(e) => set({ officials: { ...draft.officials, title: e.target.value } })} placeholder="e.g. Meet the Referees" />
          </Field>
          <div style={{ marginTop: 14 }}>
            <Repeater
              items={draft.officials.people}
              onChange={(people) => set({ officials: { ...draft.officials, people } })}
              make={() => ({ name: '', title: '', photo: '' })}
              addLabel="Add person"
              title={(p, i) => p.name || `Person ${i + 1}`}
              render={(p, update) => (
                <div className="a-grid">
                  <Field label="Name" required>
                    <input value={p.name} onChange={(e) => update({ name: e.target.value })} />
                  </Field>
                  <Field label="Title" wide>
                    <input value={p.title} onChange={(e) => update({ title: e.target.value })} />
                  </Field>
                  <ImageInput label="Photo" value={p.photo} onChange={(v) => update({ photo: v })} />
                </div>
              )}
            />
          </div>
        </section>

        <div className="a-row">
          <span className="a-spacer" />
          <button className="a-btn primary big" disabled={saving}>
            {saving ? 'Saving…' : 'Save event'}
          </button>
        </div>
      </form>
    </main>
  );
}
