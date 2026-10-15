import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { adminApi, certificateUrl } from '../api.js';
import { useMeta } from './AdminLayout.jsx';
import { ErrorBox, formatDate } from './ui.jsx';

const VERIFY_LABEL = {
  verified: ['ok', 'Verified against the blockchain'],
  revoked: ['bad', 'Revoked'],
  mismatch: ['bad', 'Does not match the blockchain'],
  not_found: ['bad', 'Not found on the blockchain'],
  pending: ['warn', 'Not on the blockchain yet'],
  unavailable: ['warn', 'Blockchain unreachable'],
};

const hasWebNfc = typeof window !== 'undefined' && 'NDEFReader' in window;

function download(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

/**
 * Writes the certificate link to an NFC tag with Web NFC (Chrome on Android).
 * The tag is read first so its serial number can be stored with the certificate.
 */
function NfcWriter({ url, onWritten }) {
  const [state, setState] = useState({ step: 'idle' });
  const [lock, setLock] = useState(false);
  const abort = useRef(null);

  useEffect(() => () => abort.current?.abort(), []);

  const start = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ step: 'waiting' });
    try {
      const reader = new window.NDEFReader();
      await reader.scan({ signal: controller.signal });
      reader.onreadingerror = () => setState({ step: 'waiting', note: 'Could not read that card. Hold it still against the phone.' });
      reader.onreading = async (event) => {
        if (controller.signal.aborted) return;
        reader.onreading = null;
        try {
          setState({ step: 'writing' });
          await reader.write({ records: [{ recordType: 'url', data: url }] }, { signal: controller.signal });
          if (lock && reader.makeReadOnly) await reader.makeReadOnly({ signal: controller.signal });
          controller.abort();
          await onWritten(event.serialNumber || '');
          setState({ step: 'done', serial: event.serialNumber, locked: lock });
        } catch (err) {
          controller.abort();
          setState({ step: 'error', message: err.message });
        }
      };
    } catch (err) {
      setState({ step: 'error', message: err.name === 'NotAllowedError' ? 'NFC permission was denied.' : err.message });
    }
  };

  const cancel = () => {
    abort.current?.abort();
    setState({ step: 'idle' });
  };

  if (!hasWebNfc) {
    return (
      <div className="a-nfc">
        <b>Write with an NFC app</b>
        <p className="a-hint" style={{ margin: '4px 0 0' }}>
          This browser cannot write NFC. Open this page in Chrome on an Android phone to write directly, or use an app such as NXP TagWriter or NFC Tools:
        </p>
        <ol>
          <li>Copy the certificate link above.</li>
          <li>In the app, write a URL / link record with it to the card.</li>
          <li>Come back and mark the card as written.</li>
        </ol>
        <div className="a-row" style={{ marginTop: 12 }}>
          <button type="button" className="a-btn small" onClick={() => onWritten('')}>
            Mark card as written
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="a-nfc">
      {state.step === 'idle' && (
        <>
          <label className="a-check">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
            Lock the chip after writing (permanent, cannot be rewritten)
          </label>
          <div className="a-row" style={{ marginTop: 12 }}>
            <button type="button" className="a-btn primary" onClick={start}>
              Write to NFC card
            </button>
          </div>
        </>
      )}
      {state.step === 'waiting' && (
        <div className="a-row">
          <span className="a-pulse" aria-hidden="true" />
          <span>Hold the card against the back of this phone…</span>
          <span className="a-spacer" />
          <button type="button" className="a-btn small" onClick={cancel}>
            Cancel
          </button>
          {state.note && <small style={{ width: '100%' }}>{state.note}</small>}
        </div>
      )}
      {state.step === 'writing' && (
        <div className="a-row">
          <span className="a-pulse" aria-hidden="true" />
          Writing… keep holding the card.
        </div>
      )}
      {state.step === 'done' && (
        <div>
          <div className="a-alert ok" style={{ marginBottom: 10 }}>
            Card written{state.locked ? ' and locked' : ''}. Tap it with any phone to open the certificate.
            {state.serial && (
              <>
                <br />
                Chip serial: <code>{state.serial}</code>
              </>
            )}
          </div>
          <button type="button" className="a-btn small" onClick={() => setState({ step: 'idle' })}>
            Write another card
          </button>
        </div>
      )}
      {state.step === 'error' && (
        <div>
          <div className="a-alert" style={{ marginBottom: 10 }}>
            {state.message}
          </div>
          <button type="button" className="a-btn small" onClick={start}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export default function CertificateDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const meta = useMeta();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState('');

  const load = () => adminApi(`/certificates/${id}`).then(setCert, setError);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const url = certificateUrl(id, meta?.publicBaseUrl);
  const localOnly = /\/\/(localhost|127\.|\[::1\])/.test(url);

  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 720 }).then(setQr);
  }, [url]);

  if (!cert) {
    return (
      <main className="a-main">
        <ErrorBox error={error} />
      </main>
    );
  }

  const v = cert.verification;
  const [tone, label] = VERIFY_LABEL[v.status] || ['', v.status];
  const slug = cert.recipientName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const act = async (name, fn) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(href, `qr-${slug}-${id}.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <main className="a-main">
      <div className="a-head">
        <div>
          <h1>{cert.recipientName}</h1>
          <p>
            {cert.payload.role.label} · {cert.payload.event.name}
          </p>
        </div>
        <div className="a-row">
          <a href={url} target="_blank" rel="noopener noreferrer" className="a-btn">
            Open certificate
          </a>
          <Link to={`/admin/issue?event=${cert.eventId}`} className="a-btn primary">
            Issue another
          </Link>
        </div>
      </div>

      {params.get('issued') && cert.chain.status === 'anchored' && <div className="a-alert ok">Certificate issued and recorded on the blockchain.</div>}
      {cert.chain.status === 'pending' && (
        <div className="a-alert warn">
          Issued, but not on the blockchain yet{cert.chain.error ? `: ${cert.chain.error}` : '.'}{' '}
          <button type="button" className="a-btn small" disabled={busy === 'anchor'} onClick={() => act('anchor', () => adminApi(`/certificates/${id}/anchor`, { method: 'POST' }))}>
            {busy === 'anchor' ? 'Retrying…' : 'Retry now'}
          </button>
        </div>
      )}
      <ErrorBox error={error} />

      <div className="a-detail">
        <section className="a-card">
          <h2>Card link</h2>
          <p className="a-hint">Print the QR code on the card and write the same link to its NFC chip.</p>
          {localOnly && (
            <div className="a-alert warn">
              This link uses <b>localhost</b>, which a phone cannot open. Set <code>PUBLIC_BASE_URL</code> in the backend .env to your LAN or tunnel address, or
              open the admin from that address.
            </div>
          )}
          <div className="a-qr">
            {qr && <img src={qr} alt={`QR code for ${url}`} />}
            <div className="a-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button type="button" className="a-btn small" onClick={() => download(qr, `qr-${slug}-${id}.png`)}>
                Download PNG
              </button>
              <button type="button" className="a-btn small" onClick={downloadSvg}>
                Download SVG (for print)
              </button>
            </div>
          </div>
          <div className="a-link">
            <code title={url}>{url}</code>
            <button type="button" className="a-btn small" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <h2 style={{ marginTop: 22 }}>NFC chip</h2>
          <p className="a-hint">
            {cert.nfc.writtenAt ? `Written ${formatDate(cert.nfc.writtenAt)}${cert.nfc.uid ? ` · chip ${cert.nfc.uid}` : ''}` : 'Not written yet.'}
          </p>
          <NfcWriter url={url} onWritten={(uid) => act('nfc', () => adminApi(`/certificates/${id}/nfc`, { method: 'POST', body: { uid } }))} />
        </section>

        <section className="a-card">
          <h2>Blockchain record</h2>
          <p className="a-hint">Checked live: the certificate is re-fingerprinted and compared with the chain.</p>
          <dl className="a-kv">
            <dt>Status</dt>
            <dd>
              <span className={`a-pill ${tone}`}>{label}</span>
            </dd>
            <dt>Certificate ID</dt>
            <dd>
              <code>{cert.id}</code>
            </dd>
            <dt>Fingerprint</dt>
            <dd>
              <code>{cert.fingerprint}</code>
            </dd>
            {v.chainName && (
              <>
                <dt>Chain</dt>
                <dd>
                  {v.chainName} ({v.chainId})
                </dd>
              </>
            )}
            {v.contract && (
              <>
                <dt>Contract</dt>
                <dd>
                  <code>{v.contract}</code>
                </dd>
              </>
            )}
            {cert.chain.txHash && (
              <>
                <dt>Transaction</dt>
                <dd>
                  {cert.chain.txUrl ? (
                    <a href={cert.chain.txUrl} target="_blank" rel="noopener noreferrer">
                      <code>{cert.chain.txHash}</code>
                    </a>
                  ) : (
                    <code>{cert.chain.txHash}</code>
                  )}
                </dd>
                <dt>Block</dt>
                <dd>{cert.chain.blockNumber}</dd>
              </>
            )}
            <dt>Issued</dt>
            <dd>{formatDate(cert.issuedAt)}</dd>
            {cert.revokedAt && (
              <>
                <dt>Revoked</dt>
                <dd>{formatDate(cert.revokedAt)}</dd>
              </>
            )}
          </dl>

          <h2 style={{ marginTop: 22 }}>Details</h2>
          <dl className="a-kv">
            {cert.payload.fields.map((f) => (
              <FieldRow key={f.key} label={f.label} value={f.value} />
            ))}
            {cert.couponCode && <FieldRow label="Coupon code" value={cert.couponCode} />}
          </dl>

          {!cert.revokedAt && (
            <div className="a-row" style={{ marginTop: 22 }}>
              <button
                type="button"
                className="a-btn danger small"
                disabled={busy === 'revoke'}
                onClick={() => {
                  if (window.confirm(`Revoke ${cert.recipientName}'s certificate? Its page will show it as revoked. This cannot be undone.`))
                    act('revoke', () => adminApi(`/certificates/${id}/revoke`, { method: 'POST' }));
                }}
              >
                {busy === 'revoke' ? 'Revoking…' : 'Revoke certificate'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FieldRow({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd style={{ whiteSpace: 'pre-line' }}>{value}</dd>
    </>
  );
}
