import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Reads a QR code from the camera and reports its text once. */
export default function QrScanner({ onResult, onClose }) {
  const video = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    let frame;
    let done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const v = video.current;
      if (done || !v) return;
      if (v.readyState >= 2 && v.videoWidth) {
        // Decode a downscaled frame; plenty for a card held in front of the camera.
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          done = true;
          onResult(code.data);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        video.current.play().catch(() => {});
        frame = requestAnimationFrame(tick);
      })
      .catch((err) => setError(err.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'No camera available. Type the card code instead.'));
    if (!navigator.mediaDevices) setError('The camera needs HTTPS or localhost. Type the card code instead.');

    return () => {
      done = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="a-scanner">
      {error ? <div className="a-alert warn">{error}</div> : <video ref={video} playsInline muted aria-label="Camera preview" />}
      <div className="a-row" style={{ marginTop: 10 }}>
        {!error && <small className="a-hint" style={{ margin: 0 }}>Point the camera at the card's QR code.</small>}
        <span className="a-spacer" />
        <button type="button" className="a-btn small" onClick={onClose}>
          Close camera
        </button>
      </div>
    </div>
  );
}
