export const hasWebNfc = typeof window !== 'undefined' && 'NDEFReader' in window;

/**
 * Waits for an NFC tag, writes a URL record to it, optionally locks it, and
 * resolves with the tag's serial number. Web NFC only (Chrome on Android).
 */
export function writeUrlToTag(url, { lock = false, signal, onNote } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new window.NDEFReader();
    signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    reader.onreadingerror = () => onNote?.('Could not read that card. Hold it still against the phone.');
    reader.onreading = async (event) => {
      reader.onreading = null;
      try {
        await reader.write({ records: [{ recordType: 'url', data: url }] }, { signal });
        if (lock && reader.makeReadOnly) await reader.makeReadOnly({ signal });
        resolve(event.serialNumber || '');
      } catch (err) {
        reject(err);
      }
    };
    reader.scan({ signal }).catch(reject);
  });
}

export function nfcErrorMessage(err) {
  if (err?.name === 'NotAllowedError') return 'NFC permission was denied.';
  if (err?.name === 'NotSupportedError') return 'NFC is off or not supported on this phone.';
  return err?.message || 'Could not write the card.';
}
