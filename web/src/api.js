async function ok(res) {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
  return res;
}

export const getRepo = () => fetch('/api/repo').then(ok).then((r) => r.json());

export const getCommits = (params) =>
  fetch(`/api/commits?${new URLSearchParams(params)}`).then(ok).then((r) => r.json());

export const getDiff = (params) =>
  fetch(`/api/diff?${new URLSearchParams(params)}`).then(ok).then((r) => r.text());

const json = { 'content-type': 'application/json' };

export const getComments = () => fetch('/api/comments').then(ok).then((r) => r.json());

export const createComment = (comment) =>
  fetch('/api/comments', { method: 'POST', headers: json, body: JSON.stringify(comment) })
    .then(ok)
    .then((r) => r.json());

export const updateComment = (id, patch) =>
  fetch(`/api/comments/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify(patch) })
    .then(ok)
    .then((r) => r.json());

export const deleteComment = (id) =>
  fetch(`/api/comments/${id}`, { method: 'DELETE' }).then(ok);

export const generatePrompt = (payload) =>
  fetch('/api/prompt', { method: 'POST', headers: json, body: JSON.stringify(payload) })
    .then(ok)
    .then((r) => r.text());
