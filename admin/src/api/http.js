let token = localStorage.getItem('admin_token') || null;
export function apiToken() { return token; }
export function setToken(t) { token = t; if (t) localStorage.setItem('admin_token', t); else localStorage.removeItem('admin_token'); }

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json?.data ?? json;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p),
};
