import { keccak256, toUtf8Bytes } from 'ethers';

/** JSON with object keys sorted at every level, so the same data always hashes the same. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The value stored on-chain for a certificate's payload. */
export function fingerprintOf(payload) {
  return keccak256(toUtf8Bytes(canonicalJson(payload)));
}

/** The on-chain key for a certificate id. */
export function chainIdOf(certificateId) {
  return keccak256(toUtf8Bytes(`a8:certificate:${certificateId}`));
}
