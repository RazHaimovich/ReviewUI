async function ok(res) {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res;
}

export const getRepo = () => fetch('/api/repo').then(ok).then((r) => r.json());

export const getDiff = (params) =>
  fetch(`/api/diff?${new URLSearchParams(params)}`).then(ok).then((r) => r.text());
