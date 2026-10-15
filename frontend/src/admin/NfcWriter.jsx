import { useEffect, useRef, useState } from 'react';
import { hasWebNfc, nfcErrorMessage, writeUrlToTag } from './nfc.js';

/**
 * Writes a link to an NFC tag with Web NFC (Chrome on Android).
 * The tag is read first so its serial number can be stored with the record.
 */
export default function NfcWriter({ url, onWritten }) {
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
      const serial = await writeUrlToTag(url, {
        lock,
        signal: controller.signal,
        onNote: (note) => setState({ step: 'waiting', note }),
      });
      controller.abort();
      await onWritten(serial);
      setState({ step: 'done', serial, locked: lock });
    } catch (err) {
      controller.abort();
      if (err?.name !== 'AbortError') setState({ step: 'error', message: nfcErrorMessage(err) });
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
          <li>Copy the link above.</li>
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
      {state.step === 'done' && (
        <div>
          <div className="a-alert ok" style={{ marginBottom: 10 }}>
            Card written{state.locked ? ' and locked' : ''}. Tap it with any phone to open the link.
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
