import { useEffect, useState } from 'react';
import { parseDiff } from 'react-diff-view';
import { getRepo, getCommits, getDiff, getComments, createComment, deleteComment, generatePrompt } from './api.js';
import CommitBar from './CommitBar.jsx';
import FileDiff, { filePath } from './FileDiff.jsx';
import PromptModal from './PromptModal.jsx';

function BranchSelect({ label, value, branches, onChange }) {
  return (
    <label className="flex items-center gap-1 font-mono text-xs text-gray-600">
      {label}
      <select
        className="rounded border border-gray-300 bg-white px-2 py-0.5"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {branches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  const [repo, setRepo] = useState(null);
  const [base, setBase] = useState(null);
  const [head, setHead] = useState(null);
  const [commits, setCommits] = useState([]);
  const [view, setView] = useState('final'); // 'final' or a commit sha
  const [mode, setMode] = useState('single');
  const [files, setFiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [prompt, setPrompt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRepo()
      .then((info) => {
        setRepo(info);
        setBase(info.defaultBase ?? info.branches.find((b) => b !== info.current) ?? info.current);
        setHead(info.current);
      })
      .catch((err) => setError(err.message));
    getComments().then(setComments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!base || !head) return;
    setView('final');
    getCommits({ base, head }).then(setCommits).catch((err) => setError(err.message));
  }, [base, head]);

  useEffect(() => {
    if (!base || !head) return;
    const params = { base, head };
    if (view !== 'final') Object.assign(params, { commit: view, mode });
    getDiff(params)
      .then((text) => {
        setFiles(text.trim() ? parseDiff(text) : []);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [base, head, view, mode]);

  const refreshComments = () => getComments().then(setComments);
  const onCreateComment = (comment) =>
    createComment({
      ...comment,
      commitSha: view === 'final' ? null : view,
      mode: view === 'final' ? null : mode,
    })
      .then(refreshComments)
      .catch((err) => setError(err.message));
  const onDeleteComment = (id) =>
    deleteComment(id).then(refreshComments).catch((err) => setError(err.message));

  const onGenerate = () =>
    generatePrompt({ base, head }).then(setPrompt).catch((err) => setError(err.message));

  if (!repo) {
    return <p className="p-6 text-gray-500">{error ? `ReviewUI error: ${error}` : 'Loading…'}</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b border-gray-300 bg-white px-4 py-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-semibold">{repo.name}</h1>
          <BranchSelect label="base" value={base} branches={repo.branches} onChange={setBase} />
          <span className="text-gray-400">…</span>
          <BranchSelect label="compare" value={head} branches={repo.branches} onChange={setHead} />
          <span className="text-sm text-gray-500">{files.length} files changed</span>
          <span className="grow" />
          <button
            onClick={onGenerate}
            disabled={comments.length === 0}
            className="rounded bg-green-700 px-3 py-1 text-sm text-white hover:bg-green-800 disabled:opacity-40"
          >
            Generate Prompt ({comments.length})
          </button>
        </div>
        <div className="mt-2">
          <CommitBar commits={commits} view={view} mode={mode} onView={setView} onMode={setMode} />
        </div>
      </header>
      {error && <p className="px-4 pt-4 text-red-700">ReviewUI error: {error}</p>}
      <main className="flex items-start gap-4 p-4">
        <nav className="sticky top-24 w-64 shrink-0 rounded-md border border-gray-300 bg-white p-2 text-sm">
          {files.map((file) => {
            const path = filePath(file);
            const count = comments.filter((c) => c.filePath === path).length;
            return (
              <a
                key={path}
                href={`#${path}`}
                className="flex items-center gap-1 truncate rounded px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-100"
              >
                <span className="truncate">{path}</span>
                {count > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-amber-200 px-1.5 font-sans text-[10px]">
                    {count}
                  </span>
                )}
              </a>
            );
          })}
          {files.length === 0 && <p className="px-2 py-1 text-gray-500">No changes</p>}
        </nav>
        <div className="min-w-0 flex-1">
          {files.map((file) => (
            <FileDiff
              key={filePath(file)}
              file={file}
              comments={comments.filter((c) => c.filePath === filePath(file))}
              onCreate={onCreateComment}
              onDelete={onDeleteComment}
            />
          ))}
        </div>
      </main>
      {prompt !== null && <PromptModal text={prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}
