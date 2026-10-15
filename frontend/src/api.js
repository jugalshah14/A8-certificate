const TOKEN_KEY = 'a8_admin_token';

export const auth = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked; sign-in lasts for this page only */
    }
  },
};

async function request(path, { method = 'GET', body, form, token } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.problems = data.problems;
    throw err;
  }
  return data;
}

export const publicApi = (path, options) => request(path, options);

export async function adminApi(path, options = {}) {
  try {
    return await request(path, { ...options, token: auth.token });
  } catch (err) {
    if (err.status === 401) {
      auth.set(null);
      window.location.assign('/admin/login');
    }
    throw err;
  }
}

/** The link written to the NFC chip and encoded in the QR code. */
export function certificateUrl(id, publicBaseUrl) {
  return `${publicBaseUrl || window.location.origin}/c/${id}`;
}
