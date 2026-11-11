/** Client-side JSON helpers shared by SWR hooks and buttons. Errors carry the API's `error` message. */

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export async function send<T>(url: string, method: 'POST' | 'PATCH' | 'PUT', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Request failed (${res.status})`), { status: res.status });
  return json as T;
}
