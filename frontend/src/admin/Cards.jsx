import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { adminApi, certificateUrl } from '../api.js';
import { useMeta } from './AdminLayout.jsx';
import NfcWriter from './NfcWriter.jsx';
import { ErrorBox, Field, formatDate } from './ui.jsx';

const STATUS = {
  blank: ['', 'Blank'],
  issued: ['ok', 'Issued'],
  void: ['bad', 'Void'],
};

function downloadCsv(cards, publicBaseUrl, filename) {
  const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['serial', 'code', 'url', 'status'].join(',')];
  for (const c of cards) lines.push([c.label, c.code, certificateUrl(c.code, publicBaseUrl), c.status].map(quote).join(','));
  const href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** One card's QR code, link and NFC writer. */
function CardPanel({ card, publicBaseUrl, onChanged, onClose }) {
  const url = certificateUrl(card.code, publicBaseUrl);
  const [qr, setQr] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 480 }).then(setQr);
  }, [url]);

  const written = async (uid) => {
    setError(null);
    try {
      await adminApi(`/cards/${card.code}/nfc`, { method: 'POST', body: { uid } });
      onChanged();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="a-card">
      <div className="a-row">
        <h2 style={{ margin: 0 }}>Card {card.label}</h2>
        <span className={`a-pill ${STATUS[card.status][0]}`}>{STATUS[card.status][1]}</span>
        <span className="a-spacer" />
        <button type="button" className="a-btn small" onClick={onClose}>
          Close
        </button>
      </div>
      <ErrorBox error={error} />
      <div className="a-qr" style={{ marginTop: 14 }}>
        {qr && <img src={qr} alt={`QR code for ${url}`} />}
        <dl className="a-kv" style={{ flex: 1, minWidth: 220 }}>
          <dt>Code</dt>
          <dd>
            <code>{card.code}</code>
          </dd>
          <dt>Batch</dt>
          <dd>{card.batchNote || card.batchId}</dd>
          {card.certificateId && (
            <>
              <dt>Issued to</dt>
              <dd>
                <Link to={`/admin/certificates/${card.certificateId}`}>{card.recipientName}</Link>
              </dd>
            </>
          )}
          <dt>NFC chip</dt>
          <dd>{card.nfc.writtenAt ? `Written ${formatDate(card.nfc.writtenAt)}${card.nfc.uid ? ` · ${card.nfc.uid}` : ''}` : 'Not written yet'}</dd>
        </dl>
      </div>
      <div className="a-link">
        <code title={url}>{url}</code>
      </div>
      {card.status !== 'void' && (
        <div style={{ marginTop: 14 }}>
          <NfcWriter key={card.code} url={url} onWritten={written} />
        </div>
      )}
    </section>
  );
}

export default function Cards() {
  const meta = useMeta();
  const isAdmin = meta?.user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState(null);
  const eventId = params.get('event') || events?.[0]?.id || '';
  const [batches, setBatches] = useState(null);
  const [cards, setCards] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState('');
  const [count, setCount] = useState(50);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    adminApi('/events').then(setEvents, setError);
  }, []);

  const load = () => {
    if (!eventId) return Promise.resolve();
    return Promise.all([adminApi(`/events/${eventId}/batches`).then(setBatches), adminApi(`/cards?eventId=${eventId}`).then(setCards)]).catch(setError);
  };

  useEffect(() => {
    setBatches(null);
    setCards(null);
    setSelected('');
    setCreated(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const event = events?.find((e) => e.id === eventId);
  const stats = batches?.stats;
  const needle = q.trim().toLowerCase().replace(/^#0*/, '');
  const shown = (cards || []).filter(
    (c) =>
      (!status || c.status === status) &&
      (!needle || c.code.toLowerCase().includes(needle) || String(c.serial) === needle || (c.recipientName || '').toLowerCase().includes(needle))
  );
  const selectedCard = cards?.find((c) => c.code === selected);
  const localOnly = /\/\/(localhost|127\.|\[::1\])/.test(certificateUrl('x', meta?.publicBaseUrl));

  const makeBatch = async (e) => {
    e.preventDefault();
    setBusy('batch');
    setError(null);
    try {
      const batch = await adminApi(`/events/${eventId}/cards`, { method: 'POST', body: { count: Number(count), note } });
      setCreated(batch);
      setNote('');
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy('');
    }
  };

  const voidCard = async (card) => {
    if (!window.confirm(`Void card ${card.label}? It can no longer be issued, and its link will say the card is not valid.`)) return;
    setBusy(card.code);
    setError(null);
    try {
      await adminApi(`/cards/${card.code}/void`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy('');
    }
  };

  const batchCards = (batchId) => (cards || []).filter((c) => c.batchId === batchId);

  if (events && events.length === 0) {
    return (
      <main className="a-main a-narrow">
        <div className="a-card a-empty">Create an event first.</div>
      </main>
    );
  }

  return (
    <main className="a-main">
      <div className="a-head">
        <div>
          <h1>Cards</h1>
          <p>Make blank QR and NFC cards for an event and print them before the day. A card gets its certificate when you issue to it.</p>
        </div>
        {eventId && (
          <Link to={`/admin/issue?event=${eventId}`} className="a-btn primary">
            Issue to a card
          </Link>
        )}
      </div>

      <div className="a-row" style={{ marginBottom: 14 }}>
        <select value={eventId} onChange={(e) => setParams({ event: e.target.value })} style={{ maxWidth: 320 }} aria-label="Event">
          {events?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {stats && (
          <>
            <span className="a-pill">{stats.total} cards</span>
            <span className="a-pill">{stats.blank} blank</span>
            <span className="a-pill ok">{stats.issued} issued</span>
            {stats.voided > 0 && <span className="a-pill bad">{stats.voided} void</span>}
          </>
        )}
      </div>

      <ErrorBox error={error} />
      {localOnly && (
        <div className="a-alert warn">
          Card links use <b>localhost</b>, which a phone cannot open. Set <code>PUBLIC_BASE_URL</code> in the backend .env to the address phones will use before you
          print, because printed codes cannot be changed later.
        </div>
      )}

      {isAdmin && event && (
        <form className="a-card" onSubmit={makeBatch}>
          <h2>Make a batch of cards</h2>
          <p className="a-hint">Cards are numbered after the last card of {event.name}.</p>
          <div className="a-grid two">
            <Field label="How many cards" required hint={`Up to ${batches?.maxBatch || 1000} at a time.`}>
              <input type="number" min={1} max={batches?.maxBatch || 1000} value={count} onChange={(e) => setCount(e.target.value)} required />
            </Field>
            <Field label="Note" hint="Optional, e.g. the print run or venue.">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Print run 1" />
            </Field>
          </div>
          <div className="a-row" style={{ marginTop: 14 }}>
            <button className="a-btn primary" disabled={busy === 'batch'}>
              {busy === 'batch' ? 'Making cards…' : 'Make cards'}
            </button>
            {created && (
              <span className="a-alert ok" style={{ margin: 0 }}>
                Made {created.total} cards (#{String(created.first).padStart(4, '0')} to #{String(created.last).padStart(4, '0')}).{' '}
                <Link to={`/admin/cards/print?event=${eventId}&batch=${created.batchId}`} target="_blank">
                  Print them
                </Link>
              </span>
            )}
          </div>
        </form>
      )}

      {batches?.batches.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h2>Batches</h2>
          <div className="a-tableWrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Cards</th>
                  <th>Note</th>
                  <th>Made</th>
                  <th>Issued</th>
                  <th>NFC written</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.batches.map((b) => (
                  <tr key={b.batchId}>
                    <td>
                      #{String(b.first).padStart(4, '0')} – #{String(b.last).padStart(4, '0')} ({b.total})
                    </td>
                    <td>{b.note || '—'}</td>
                    <td>{formatDate(b.createdAt)}</td>
                    <td>
                      {b.issued} / {b.total - b.voided}
                    </td>
                    <td>{b.nfcWritten}</td>
                    <td>
                      <div className="a-row">
                        <Link to={`/admin/cards/print?event=${eventId}&batch=${b.batchId}`} target="_blank" className="a-btn small">
                          Print sheet
                        </Link>
                        <button
                          type="button"
                          className="a-btn small"
                          onClick={() => downloadCsv(batchCards(b.batchId), meta?.publicBaseUrl, `cards-${b.first}-${b.last}.csv`)}
                        >
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedCard && (
        <CardPanel card={selectedCard} publicBaseUrl={meta?.publicBaseUrl} onChanged={load} onClose={() => setSelected('')} />
      )}

      {cards?.length > 0 && (
        <section>
          <div className="a-row" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>All cards</h2>
            <span className="a-spacer" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 160 }} aria-label="Status">
              <option value="">Any status</option>
              <option value="blank">Blank</option>
              <option value="issued">Issued</option>
              <option value="void">Void</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number, code or name" style={{ maxWidth: 220 }} aria-label="Search cards" />
          </div>
          <div className="a-tableWrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Issued to</th>
                  <th>NFC</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((c) => (
                  <tr key={c.code}>
                    <td>
                      <b>{c.label}</b>
                    </td>
                    <td>
                      <code>{c.code}</code>
                    </td>
                    <td>
                      <span className={`a-pill ${STATUS[c.status][0]}`}>{STATUS[c.status][1]}</span>
                    </td>
                    <td>{c.certificateId ? <Link to={`/admin/certificates/${c.certificateId}`}>{c.recipientName}</Link> : '—'}</td>
                    <td>{c.nfc.writtenAt ? <span className="a-pill ok">Written</span> : <span className="a-pill">Not yet</span>}</td>
                    <td>
                      <div className="a-row">
                        <button type="button" className="a-btn small" aria-pressed={selected === c.code} onClick={() => setSelected(c.code)}>
                          QR / NFC
                        </button>
                        {isAdmin && c.status === 'blank' && (
                          <button type="button" className="a-btn small danger" disabled={busy === c.code} onClick={() => voidCard(c)}>
                            Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <div className="a-empty">No cards match.</div>}
            {shown.length > 500 && <div className="a-empty">Showing the first 500 of {shown.length}. Search to narrow down.</div>}
          </div>
        </section>
      )}

      {cards?.length === 0 && (
        <div className="a-card a-empty">{isAdmin ? 'No cards for this event yet. Make a batch above.' : 'No cards for this event yet. Ask an admin to make a batch.'}</div>
      )}
    </main>
  );
}
