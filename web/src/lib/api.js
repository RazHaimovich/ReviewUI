const jsonHeaders = { 'content-type': 'application/json' };

async function ok(res) {
  if (!res.ok) {
    let payload;
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }
    throw new Error(payload.error ?? res.statusText);
  }
  return res;
}

export async function getRepo() {
  const res = await ok(await fetch('/api/repo'));
  return res.json();
}

export async function getCommits(params) {
  const res = await ok(await fetch(`/api/commits?${new URLSearchParams(params)}`));
  return res.json();
}

export async function getDiff(params) {
  const res = await ok(await fetch(`/api/diff?${new URLSearchParams(params)}`));
  return res.text();
}

export async function getComments() {
  const res = await ok(await fetch('/api/comments'));
  return res.json();
}

export async function createComment(comment) {
  const res = await ok(
    await fetch('/api/comments', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(comment) })
  );
  return res.json();
}

export async function updateComment(id, patch) {
  const res = await ok(
    await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(patch) })
  );
  return res.json();
}

export async function deleteComment(id) {
  return ok(await fetch(`/api/comments/${id}`, { method: 'DELETE' }));
}

export async function generatePrompt(payload) {
  const res = await ok(
    await fetch('/api/prompt', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) })
  );
  return res.text();
}
