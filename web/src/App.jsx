import { useEffect, useState } from 'react';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import { getRepo, getDiff } from './api.js';

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

export default function App() {
  const [repo, setRepo] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRepo()
      .then(async (info) => {
        setRepo(info);
        if (!info.defaultBase) return;
        const text = await getDiff({ base: info.defaultBase, head: info.current });
        setFiles(text.trim() ? parseDiff(text) : []);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="p-6 text-red-700">ReviewUI error: {error}</p>;
  if (!repo) return <p className="p-6 text-gray-500">Loading…</p>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-300 px-4 py-3 flex items-baseline gap-3">
        <h1 className="font-semibold">{repo.name}</h1>
        <span className="font-mono text-sm text-gray-600">
          {repo.defaultBase ?? '?'} … {repo.current}
        </span>
        <span className="text-sm text-gray-500">{files.length} files changed</span>
      </header>
      <main className="flex gap-4 p-4 items-start">
        <nav className="w-64 shrink-0 sticky top-16 rounded-md border border-gray-300 bg-white p-2 text-sm">
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
