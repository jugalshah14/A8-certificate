import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { publicApi } from '../api.js';
import { A8Mark, Icon, Diamond, RuleMark } from './icons.jsx';
import './certificate.css';

const PLACEHOLDER = {
  photoL: '/placeholders/photo-l.svg',
  photo: '/placeholders/photo.svg',
  cardFront: '/placeholders/card-front.svg',
  cardBack: '/placeholders/card-back.svg',
};

const STATUS = {
  verified: { tone: 'ok', title: 'The certificate is authenticated', sub: 'View proof of authenticity', pill: 'Verified on the blockchain' },
  revoked: { tone: 'bad', title: 'This certificate has been revoked', sub: 'The issuer withdrew it. See details', pill: 'Revoked' },
  mismatch: { tone: 'bad', title: 'This record does not match the blockchain', sub: 'It may have been altered. Do not rely on it', pill: 'Does not match' },
  not_found: { tone: 'bad', title: 'No blockchain record found', sub: 'This certificate could not be authenticated', pill: 'Not on the blockchain' },
  pending: { tone: 'warn', title: 'Authentication in progress', sub: 'The record is not on the blockchain yet', pill: 'Pending' },
  unavailable: { tone: 'warn', title: 'Could not check the blockchain', sub: 'Please try again in a moment', pill: 'Check unavailable' },
};

const TIER_CLASS = { gold: '', silver: 'silver', bronze: 'bronze', rose: 'rose' };

function themeStyle(theme) {
  return {
    '--t-primary': theme.primary,
    '--t-primary-deep': theme.primaryDeep,
    '--t-accent': theme.accent,
    '--t-accent-soft': theme.accentSoft,
    '--t-ink': theme.ink,
    '--t-surface': theme.surface,
    '--t-surface-soft': theme.surfaceSoft,
    '--t-heading-font': `"${theme.headingFont}"`,
  };
}

function short(hex) {
  return hex ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : '';
}

function Divider({ children }) {
  return (
    <div className="divider">
      <span className="label">
        <Diamond />
        {children}
        <Diamond />
      </span>
    </div>
  );
}

function Emblem({ src }) {
  if (!src) return <span className="emb noimg" />;
  return (
    <span className="emb">
      <img src={src} alt="" />
    </span>
  );
}

// The award text shrinks to fit the side panel; long multi-word labels wrap per word, as in the template.
function AwardLabel({ label }) {
  const text = label.toUpperCase();
  const lines = text.length > 10 && text.includes(' ') ? text.split(/\s+/) : [text];
  const chars = Math.max(...lines.map((l) => l.length));
  return (
    <div className="lfAward" style={{ '--chars': chars, lineHeight: lines.length > 1 ? 1.08 : undefined }}>
      {lines.map((l, i) => (
        <span key={i} style={{ display: 'block' }}>
          {l}
        </span>
      ))}
    </div>
  );
}

// Facts sit in a 6-column grid: rows of three, with a final row of two or one stretched to fill.
function factSpans(n) {
  const spans = Array(n).fill('s2');
  const rest = n % 3;
  if (rest === 2) spans.splice(n - 2, 2, 's3', 's3');
  if (rest === 1) spans[n - 1] = 's6';
  return spans;
}

export default function CertificatePage() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });
  const [proofOpen, setProofOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lightbox = useRef(null);
  const [lightboxSrc, setLightboxSrc] = useState('');

  useEffect(() => {
    let alive = true;
    publicApi(`/public/certificates/${encodeURIComponent(id)}`)
      .then((data) => alive && setState({ data }))
      .catch((err) => alive && setState({ error: err.status === 404 ? 'not_found' : 'failed' }));
    return () => {
      alive = false;
    };
  }, [id]);

  const data = state.data;

  useEffect(() => {
    if (!data) return;
    const { certificate: c, event: e } = data;
    document.title = `${c.recipientName} · ${c.role.label}, ${e.name}${e.city ? ` – ${e.city}` : ''}`;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = e.theme.primary;
  }, [data]);

  if (state.loading) {
    return <div className="page state" style={themeStyle(defaultTheme)} aria-busy="true" />;
  }
  if (state.error) {
    return (
      <div className="page state" style={themeStyle(defaultTheme)}>
        <div>
          <h1>{state.error === 'not_found' ? 'Certificate not found' : 'Could not load this certificate'}</h1>
          <p>{state.error === 'not_found' ? 'Check the link on the card, or tap the card again.' : 'Please check your connection and try again.'}</p>
        </div>
      </div>
    );
  }

  const { certificate: c, event: e, verification: v } = data;
  const role = c.role;
  const status = STATUS[v.status] || STATUS.unavailable;
  const firstName = c.recipientName.split(' ')[0];
  const sponsor = e.authSponsor;
  const facts = [
    { label: role.resultLabel || 'Role', value: role.label, icon: Icon.trophy, win: true },
    e.round && { label: 'Round', value: e.round, icon: Icon.pin },
    ...c.fields.filter((f) => f.display === 'fact').map((f) => ({ label: f.label, value: f.value, icon: Icon.tag })),
    e.date && { label: 'Date', value: e.date, icon: Icon.calendar },
    e.venue && { label: 'Venue', value: e.venue, icon: Icon.venue },
  ].filter(Boolean);
  const spans = factSpans(facts.length);
  const moments = c.fields.filter((f) => f.display === 'moment');
  const photo = c.media.photo?.url;
  const where = [e.name, e.city].filter(Boolean).join(' · ');

  const open = (src) => {
    setLightboxSrc(src);
    lightbox.current?.showModal?.();
  };

  const share = () => {
    const text = `${c.recipientName} · ${role.label}, ${e.name}${e.city ? ` – ${e.city}` : ''}`;
    const payload = { title: document.title, text, url: location.href };
    if (navigator.share) navigator.share(payload).catch(() => {});
    else navigator.clipboard?.writeText(location.href);
  };

  const copyCode = (ev) => {
    ev.stopPropagation();
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    navigator.clipboard?.writeText(c.couponCode).then(done, done) ?? done();
  };

  const pageClass = ['page', TIER_CLASS[role.tier], e.theme.headingFont === 'Oswald' && 'condensed'].filter(Boolean).join(' ');

  return (
    <div className={pageClass} style={themeStyle(e.theme)}>
      {v.status === 'revoked' && <div className="revokedBanner">This certificate was revoked by the issuer.</div>}
      {v.status === 'mismatch' && <div className="revokedBanner">Warning: this record does not match its blockchain fingerprint.</div>}

      <header className="top">
        <div className="wrap topIn">
          <Emblem src={e.images.emblem} />
          <div className="rankMid">
            <small>{e.name}</small>
            <b>
              <i />
              {role.label}
              {e.round ? ` – ${e.round}` : ''}
              <i />
            </b>
          </div>
          {sponsor?.logo ? (
            <a href="#offer" aria-label={`Authentication Sponsor: ${sponsor.name}`}>
              <img className="sponsorMark" src={sponsor.logo} alt={sponsor.name} />
            </a>
          ) : (
            <span />
          )}
        </div>
      </header>

      <section className="hero">
        <div className="wrap heroGrid">
          <div className="lfWrap rv">
            <figure className="lf">
              <div className="lfSide">
                {e.images.emblem && (
                  <span className="lfEmb">
                    <Emblem src={e.images.emblem} />
                  </span>
                )}
                <div>
                  <AwardLabel label={role.label} />
                  {e.round && <span className="label lfRound">{e.round}</span>}
                </div>
                <div className="lfRule" />
                {role.tagline && <blockquote className="lfQ">{role.tagline}</blockquote>}
              </div>
              <button type="button" className="lfPhoto" onClick={() => open(photo || PLACEHOLDER.photoL)} aria-label={`View photo of ${c.recipientName} full screen`}>
                <img src={photo || PLACEHOLDER.photoL} alt={c.recipientName} />
                {v.status === 'verified' && (
                  <span className="lfBug">
                    <A8Mark className="a8sym symBug" />
                    Verified
                  </span>
                )}
              </button>
              <figcaption className="lfBottom">
                <div className="lfName">
                  <b>{c.recipientName}</b>
                  <span className="label">{where}</span>
                </div>
                {sponsor?.logo && (
                  <a className="lfSpon" href="#offer">
                    <span className="label">Authentication Sponsor</span>
                    <img src={sponsor.logo} alt={sponsor.name} />
                  </a>
                )}
              </figcaption>
            </figure>
          </div>

          <div className="thumbs rv d1">
            {[
              ['Certificate front', c.media.cardFront?.url || PLACEHOLDER.cardFront],
              ['Certificate back', c.media.cardBack?.url || PLACEHOLDER.cardBack],
              [`Photo of ${c.recipientName}`, photo || PLACEHOLDER.photo],
            ].map(([alt, src]) => (
              <button key={alt} type="button" className="thumb" onClick={() => open(src)} aria-label={`View ${alt.toLowerCase()} full screen`}>
                <img src={src} alt={alt} />
              </button>
            ))}
          </div>

          <div className="copy">
            <h1 className="rv d2">{e.name}</h1>
            <div className="rule rv d3">
              <RuleMark />
            </div>
            <div className="kind rv d3">{role.kind || `${role.label} · Physical Certificate`}</div>
            {e.round && <div className="kind when">{e.round}</div>}
            <div className="actions rv d4">
              <button type="button" className="btn" onClick={share}>
                <Icon.share />
                Share your joy with loved ones
              </button>
            </div>
            {sponsor?.offer && (
              <a href="#offer" className="gift rv d4">
                {sponsor.logo && <img src={sponsor.logo} style={{ objectFit: 'contain' }} alt={sponsor.name} />}
                <span className="t">
                  <span className="label">Authentication Sponsor · {sponsor.name}</span>
                  Your gift: <b>{sponsor.offer}</b> at {sponsor.name}
                  {sponsor.validTill ? ` · till ${sponsor.validTill}` : ''}
                </span>
                <Icon.arrow />
              </a>
            )}
          </div>
        </div>
        {e.images.hero && (
          <div className="art" aria-hidden="true">
            <img src={e.images.hero} alt="" />
          </div>
        )}
      </section>

      <section className="auth">
        <div className="wrap">
          <button
            type="button"
            className={`acard ${status.tone === 'bad' ? 'bad' : ''}`}
            aria-expanded={proofOpen}
            aria-controls="proof"
            onClick={() => setProofOpen((o) => !o)}
          >
            <span className={`aIc ${status.tone === 'ok' ? '' : status.tone}`}>
              {status.tone === 'ok' ? <A8Mark className="a8mark" label="Authentic8" /> : status.tone === 'bad' ? <Icon.warning /> : <Icon.clock />}
            </span>
            <span>
              <span className="aT">{status.title}</span>
              <span className="aS">{status.sub}</span>
            </span>
            <span className="aGo">
              <Icon.chevron />
            </span>
          </button>
          <div className="proof" id="proof" hidden={!proofOpen}>
            <ProofRow label="Status">
              <span className={`statusPill ${status.tone}`}>{status.pill}</span>
            </ProofRow>
            <ProofRow label="Authentication Partner">Authentic8</ProofRow>
            <ProofRow label="Certificate ID">
              <code>{c.id}</code>
            </ProofRow>
            <ProofRow label="NFC chip">{c.nfcSealed ? 'Sealed to this record' : 'Not written yet'}</ProofRow>
            <ProofRow label="Record fingerprint">
              <code title={v.fingerprint}>{short(v.fingerprint)}</code>
            </ProofRow>
            {v.chainName && <ProofRow label="Blockchain">{v.chainName}</ProofRow>}
            {v.contract && (
              <ProofRow label="Registry contract">
                <code title={v.contract}>{short(v.contract)}</code>
              </ProofRow>
            )}
            {v.txHash && (
              <ProofRow label="Transaction">
                {v.txUrl ? (
                  <a href={v.txUrl} target="_blank" rel="noopener noreferrer">
                    <code>{short(v.txHash)}</code>
                  </a>
                ) : (
                  <code title={v.txHash}>{short(v.txHash)}</code>
                )}
              </ProofRow>
            )}
            {v.anchoredAt && <ProofRow label="Recorded on">{new Date(v.anchoredAt).toLocaleString()}</ProofRow>}
            {v.revokedAt && <ProofRow label="Revoked on">{new Date(v.revokedAt).toLocaleString()}</ProofRow>}
            <div className="proofFoot">
              <A8Mark className="a8sym symProof" />
              This certificate is authenticated by Authentic8. Its details are fingerprinted, and the fingerprint is kept on the blockchain. This page
              recomputes the fingerprint every time it opens and compares it with the blockchain record.
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <Divider>Certification Partner</Divider>
          <div className="box cpart">
            <span className="label">This certificate is authenticated by</span>
            <div className="cpartBrand">
              <A8Mark className="a8sym symPartner" label="Authentic8" />
              <span className="cpartName">authentic8</span>
            </div>
            <p>{c.nfcSealed ? 'Its NFC chip is sealed to this record, and the ' : 'The '}record’s fingerprint is kept on the blockchain.</p>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <Divider>{role.detailsTitle || 'Certificate & Event Details'}</Divider>
          <div className="box facts">
            {facts.map((f, i) => (
              <div key={f.label + i} className={`fact ${spans[i]} ${f.win ? 'win' : ''} ${i === facts.length - 1 && facts.length % 2 === 0 ? 'mfull' : ''}`}>
                <span className="label">
                  <f.icon />
                  {f.label}
                </span>
                <b>{f.value}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {sponsor && (
        <section className="sec" id="offer">
          <div className="wrap">
            <Divider>Authentication Sponsor</Divider>
            <div className={`scard ${sponsor.url ? 'scardLink' : ''} ${sponsor.banner ? 'scardPhoto' : ''}`}>
              {sponsor.url && <a className="cardLink" href={sponsor.url} target="_blank" rel="noopener noreferrer sponsored" aria-label={`Visit ${sponsor.name}`} />}
              <div className="body">
                {sponsor.logo && (
                  <div>
                    <img className="scardLogo" src={sponsor.logo} alt={sponsor.name} />
                  </div>
                )}
                {sponsor.offer && (
                  <div className="coupon">
                    <span className="couponTag">Exclusive for certificate holders</span>
                    <span className="couponOffer">{sponsor.offer}</span>
                    {sponsor.terms && <span className="couponTerms">{sponsor.terms}</span>}
                    {sponsor.validTill && <span className="couponValid">Valid till {sponsor.validTill}</span>}
                    {c.couponCode && (
                      <span className="ticket">
                        <span className="ticketCode">{c.couponCode}</span>
                        <button type="button" className={`copyCode ${copied ? 'copied' : ''}`} onClick={copyCode} aria-label={`Copy the ${sponsor.name} code ${c.couponCode}`}>
                          <Icon.copy />
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </span>
                    )}
                  </div>
                )}
                {sponsor.cta && (
                  <div>
                    <span className="buy" aria-hidden="true">
                      {sponsor.cta}
                      <Icon.arrow />
                    </span>
                  </div>
                )}
              </div>
              {sponsor.banner && (
                <div className="ph">
                  <img src={sponsor.banner} alt="" loading="lazy" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {moments.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <Divider>{role.momentTitle || 'Their Moment'}</Divider>
            <div className="box moment">
              {moments.map((m) => (
                <div className="remarkCard" key={m.key}>
                  <div className="remarkHead">
                    <span className="label remarkLabel">
                      {m.label === 'In their words' ? `In ${firstName}'s words` : m.label}
                    </span>
                    <span className="chip">As written</span>
                  </div>
                  <p className="remarkText">{m.value}</p>
                  <div className="label remarkBy">— {c.recipientName}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {e.sponsors.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <Divider>{e.sponsors.length === 1 ? e.sponsors[0].tag || 'Sponsor' : 'Sponsor & Organiser'}</Divider>
            <div className="half">
              {e.sponsors.map((s) => (
                <div className={`scard ${s.url ? 'scardLink' : ''}`} key={s.name}>
                  {s.url && <a className="cardLink" href={s.url} target="_blank" rel="noopener noreferrer sponsored" aria-label={`Visit ${s.name}`} />}
                  <div className="body">
                    {s.tag && <span className="couponTag">{s.tag}</span>}
                    {s.logo && (
                      <div>
                        <img className="scardLogo" src={s.logo} alt={s.name} />
                      </div>
                    )}
                    {s.text && <h3>{s.text}</h3>}
                    {s.cta && (
                      <span className="buy" aria-hidden="true">
                        {s.cta}
                        <Icon.arrow />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {e.partners.length > 0 && (
        <section className="sec">
          <div className="wrap">
            <Divider>Event Partners</Divider>
            <ul className="box strip" style={{ '--cols': Math.min(e.partners.length + 1, 5) }}>
              {partnersWithA8(e.partners).map((p) => (
                <li key={p.label + p.name}>
                  <span className="lg">
                    {p.a8 ? (
                      <span className="a8">
                        <A8Mark className="a8sym symStrip" />
                        authentic8
                      </span>
                    ) : p.logo ? (
                      <img src={p.logo} alt={p.name} />
                    ) : (
                      <b>{p.name}</b>
                    )}
                  </span>
                  <span className="label">{p.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {e.officials.people.length > 0 && (
        <section className="sec" aria-label={e.officials.title}>
          <div className="wrap">
            <Divider>{e.officials.title}</Divider>
            <ul className="judgeGrid">
              {e.officials.people.map((p) => (
                <li className="judgeCard" key={p.name}>
                  <span className="judgePh">{p.photo ? <img src={p.photo} alt={p.name} loading="lazy" /> : <span className="initials" aria-hidden="true">{initials(p.name)}</span>}</span>
                  <span className="judgeBody">
                    <span className="judgeName">{p.name}</span>
                    {p.title && <span className="judgeTitle">{p.title}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {e.images.footer ? (
        <div className="closing" aria-hidden="true">
          <img src={e.images.footer} alt="" loading="lazy" />
        </div>
      ) : (
        <div style={{ height: 72 }} />
      )}
      <footer className="powered">
        <A8Mark className="a8sym symPowered" />
        Powered by Authentic8
      </footer>

      <dialog className="lb" ref={lightbox} onClick={(ev) => ev.target === lightbox.current && lightbox.current.close()}>
        <form method="dialog">
          <button className="x" aria-label="Close">
            ×
          </button>
        </form>
        {lightboxSrc && <img src={lightboxSrc} alt="" />}
      </dialog>
    </div>
  );
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/\.$/.test(w))
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function ProofRow({ label, children }) {
  return (
    <div className="proofRow">
      <span className="proofLabel">{label}</span>
      <span className="proofValue">{children}</span>
    </div>
  );
}

// Authentic8 sits in the partner strip just before the last partner, as in the template.
function partnersWithA8(partners) {
  const a8 = { a8: true, label: 'Authentication Partner', name: 'Authentic8' };
  if (partners.length < 2) return [...partners, a8];
  return [...partners.slice(0, -1), a8, partners.at(-1)];
}

const defaultTheme = {
  primary: '#1a2a5e',
  primaryDeep: '#101a3d',
  accent: '#f26a21',
  accentSoft: '#fdba74',
  ink: '#1b2033',
  surface: '#fff1e3',
  surfaceSoft: '#fff8f1',
  headingFont: 'Noto Sans',
};
