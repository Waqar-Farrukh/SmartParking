export const API_HEADERS = { 'ngrok-skip-browser-warning': 'true' };
export const API_HEADERS_JSON = { ...API_HEADERS, 'Content-Type': 'application/json' };

/** Run refreshes in parallel without blocking the UI thread. */
export function runInBackground(...fns) {
  void Promise.all(fns.map((fn) => fn())).catch((err) => console.error(err));
}

export function patchStatus(list, id, status) {
  if (!Array.isArray(list)) return list;
  return list.map((item) => (item.id === id ? { ...item, status } : item));
}
