import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { adminApi } from '../api.js';
import { useMeta } from './AdminLayout.jsx';
import { ErrorBox } from './ui.jsx';

export default function Events() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const isAdmin = useMeta()?.user?.role === 'admin';

  useEffect(() => {
    adminApi('/events').then(setEvents, setError);
  }, []);

  return (
    <main className="a-main">
      <div className="a-head">
        <div>
          <h1>Events</h1>
          <p>Each event sets its own roles, form fields, look and sponsors.</p>
        </div>
        {isAdmin && (
          <Link to="/admin/events/new" className="a-btn primary">
            New event
          </Link>
        )}
      </div>
      <ErrorBox error={error} />
      {events && events.length === 0 && <div className="a-card a-empty">No events yet. Create one to start issuing certificates.</div>}
      <div className="a-events">
        {events?.map((e) => (
          <article className="a-event" key={e.id}>
            <div className="a-eventBand" style={{ background: `linear-gradient(90deg, ${e.theme.primary} 70%, ${e.theme.accent} 70%)` }} />
            <div className="a-eventBody">
              <h2>{e.name}</h2>
              <div className="a-eventMeta">{[e.round, e.date, e.venue].filter(Boolean).join(' · ')}</div>
              <div className="a-eventMeta">
                {e.certificateCount} certificate{e.certificateCount === 1 ? '' : 's'} issued
              </div>
              <div className="a-roles">
                {e.roles.map((r) => (
                  <span className="a-pill" key={r.key}>
                    {r.label}
                  </span>
                ))}
              </div>
              <div className="a-row">
                <Link to={`/admin/issue?event=${e.id}`} className="a-btn primary small">
                  Issue certificate
                </Link>
                <Link to={`/admin/certificates?event=${e.id}`} className="a-btn small">
                  Certificates
                </Link>
                {isAdmin && (
                  <>
                    <Link to={`/admin/events/${e.id}`} className="a-btn small">
                      Edit
                    </Link>
                    <Link to={`/admin/events/new?from=${e.id}`} className="a-btn small">
                      Duplicate
                    </Link>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
