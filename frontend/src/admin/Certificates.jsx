import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { adminApi } from '../api.js';
import { CHAIN_STATUS, ErrorBox, formatDate } from './ui.jsx';

export default function Certificates() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') || '';
  const [q, setQ] = useState('');
  const [events, setEvents] = useState([]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi('/events').then(setEvents, setError);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const search = new URLSearchParams();
      if (eventId) search.set('eventId', eventId);
      if (q.trim()) search.set('q', q.trim());
      adminApi(`/certificates?${search}`).then(setRows, setError);
    }, 200);
    return () => clearTimeout(timer);
  }, [eventId, q]);

  const eventName = (id) => events.find((e) => e.id === id)?.name || '';
  const roleLabel = (c) => c.payload.role.label;

  return (
    <main className="a-main">
      <div className="a-head">
        <div>
          <h1>Certificates</h1>
          <p>Open one to show its QR code or write it to an NFC card.</p>
        </div>
        <Link to={`/admin/issue${eventId ? `?event=${eventId}` : ''}`} className="a-btn primary">
          Issue certificate
        </Link>
      </div>
      <ErrorBox error={error} />
      <div className="a-row" style={{ marginBottom: 14 }}>
        <select value={eventId} onChange={(e) => setParams(e.target.value ? { event: e.target.value } : {})} style={{ maxWidth: 320 }} aria-label="Event">
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ID" style={{ maxWidth: 260 }} aria-label="Search" />
      </div>
      <div className="a-tableWrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Event</th>
              <th>Issued</th>
              <th>Blockchain</th>
              <th>NFC card</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((c) => {
              const [tone, label] = c.revokedAt ? ['bad', 'Revoked'] : CHAIN_STATUS[c.chain.status] || ['', c.chain.status];
              return (
                <tr key={c.id}>
                  <td>
                    <Link to={`/admin/certificates/${c.id}`}>{c.recipientName}</Link>
                  </td>
                  <td>{roleLabel(c)}</td>
                  <td>{eventName(c.eventId)}</td>
                  <td>{formatDate(c.issuedAt)}</td>
                  <td>
                    <span className={`a-pill ${tone}`}>{label}</span>
                  </td>
                  <td>{c.nfc.writtenAt ? <span className="a-pill ok">Written</span> : <span className="a-pill">Not yet</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows?.length === 0 && <div className="a-empty">No certificates yet.</div>}
      </div>
    </main>
  );
}
