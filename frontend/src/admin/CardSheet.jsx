import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { adminApi, auth, certificateUrl } from '../api.js';
import './admin.css';

/** A print-ready A4 sheet of QR codes for one batch of cards. */
export default function CardSheet() {
  const [params] = useSearchParams();
  const eventId = params.get('event') || '';
  const batchId = params.get('batch') || '';
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.token) return;
    let alive = true;
    (async () => {
      const [meta, event, cards] = await Promise.all([
        adminApi('/meta'),
        adminApi(`/events/${eventId}`),
        adminApi(`/cards?eventId=${encodeURIComponent(eventId)}&batchId=${encodeURIComponent(batchId)}`),
      ]);
      const items = await Promise.all(
        cards.map(async (c) => {
          const url = certificateUrl(c.code, meta.publicBaseUrl);
          const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 0 });
          return { ...c, url, svg };
        })
      );
      if (alive) setSheet({ event, items });
    })().catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [eventId, batchId]);

  if (!auth.token) return <Navigate to="/admin/login" replace />;

  return (
    <div className="a-root a-sheetRoot">
      <div className="a-sheetBar">
        <Link to={`/admin/cards?event=${eventId}`} className="a-btn small">
          Back to cards
        </Link>
        <span>
          {sheet ? `${sheet.items.length} cards · ${sheet.event.name}` : error || 'Making QR codes…'}
        </span>
        <span className="a-spacer" />
        <button type="button" className="a-btn primary small" disabled={!sheet} onClick={() => window.print()}>
          Print
        </button>
      </div>
      {sheet && (
        <div className="a-sheet">
          {sheet.items.map((c) => (
            <div className="a-sheetCell" key={c.code}>
              <div className="a-sheetEvent">{sheet.event.name}</div>
              <div className="a-sheetQr" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <div className="a-sheetLabel">
                <b>{c.label}</b>
                <code>{c.code}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
