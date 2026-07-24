import { useEffect, useState } from 'react';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import { getRepo, getCommits, getDiff } from './api.js';
import CommitBar from './CommitBar.jsx';

function filePath(file) {
  return file.type === 'delete' ? file.oldPath : file.newPath;
}

function FileDiff({ file }) {
  return (
    <section id={filePath(file)} className="mb-4 rounded-md border border-gray-300 overflow-hidden">
      <header className="bg-gray-100 border-b border-gray-300 px-3 py-2 font-mono text-xs text-gray-700">
        {file.type === 'rename' ? `${file.oldPath} → ${file.newPath}` : filePath(file)}
        {file.type === 'add' && <span className="ml-2 text-green-700">added</span>}
        {file.type === 'delete' && <span className="ml-2 text-red-700">deleted</span>}
      </header>
      <Diff viewType="unified" diffType={file.type} hunks={file.hunks}>
        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    </section>
  );
}

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
  const [error, setError] = useState(null);

  useEffect(() => {
    getRepo()
      .then((info) => {
        setRepo(info);
        setBase(info.defaultBase ?? info.branches.find((b) => b !== info.current) ?? info.current);
        setHead(info.current);
      })
      .catch((err) => setError(err.message));
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
        </div>
        <div className="mt-2">
          <CommitBar commits={commits} view={view} mode={mode} onView={setView} onMode={setMode} />
        </div>
      </header>
      {error && <p className="px-4 pt-4 text-red-700">ReviewUI error: {error}</p>}
      <main className="flex items-start gap-4 p-4">
        <nav className="sticky top-24 w-64 shrink-0 rounded-md border border-gray-300 bg-white p-2 text-sm">
          {files.map((file) => (
            <a
              key={filePath(file)}
              href={`#${filePath(file)}`}
              className="block truncate rounded px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-100"
            >
              {filePath(file)}
            </a>
          ))}
          {files.length === 0 && <p className="px-2 py-1 text-gray-500">No changes</p>}
        </nav>
        <div className="min-w-0 flex-1">
          {files.map((file) => (
            <FileDiff key={filePath(file)} file={file} />
          ))}
        </div>
      </main>
    </div>
  );
}
