import { useEffect, useState } from 'react';
import { parseDiff } from 'react-diff-view';
import { Columns2Icon, GitCompareIcon, MoonIcon, Rows3Icon, SparklesIcon, SunIcon } from 'lucide-react';
import {
  getRepo,
  getCommits,
  getDiff,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  generatePrompt,
} from '../lib/api.js';
import CommitBar from './CommitBar.jsx';
import FileDiff, { filePath, fileStats } from './FileDiff.jsx';
import FileTree from './FileTree.jsx';
import PromptModal from './PromptModal.jsx';

function BranchSelect({ value, branches, onChange }) {
  return (
    <select
      className="rounded-md bg-panel2 px-2 py-1 font-mono text-xs text-ink hover:bg-line"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {branches.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() =>
    localStorage.reviewuiTheme
      ? localStorage.reviewuiTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.reviewuiTheme = dark ? 'dark' : 'light';
  }, [dark]);
  return [dark, setDark];
}

export default function App() {
  const [repo, setRepo] = useState(null);
  const [base, setBase] = useState(null);
  const [head, setHead] = useState(null);
  const [commits, setCommits] = useState([]);
  const [view, setView] = useState('final'); // 'final' or a commit sha
  const [mode, setMode] = useState('single');
  const [viewType, setViewType] = useState('unified');
  const [files, setFiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [prompt, setPrompt] = useState(null);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);
  const [dark, setDark] = useTheme();

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
  const onUpdateComment = (id, patch) =>
    updateComment(id, patch).then(refreshComments).catch((err) => setError(err.message));
  const onDeleteComment = (id) =>
    deleteComment(id).then(refreshComments).catch((err) => setError(err.message));

  const onGenerate = () =>
    generatePrompt({ base, head, summary }).then(setPrompt).catch((err) => setError(err.message));

  if (!repo) {
    return (
      <p className="p-6 font-mono text-sm text-muted">
        {error ? `ReviewUI error: ${error}` : 'Loading…'}
      </p>
    );
  }

  const treeEntries = files.map((file) => ({
    path: filePath(file),
    type: file.type,
    ...fileStats(file),
    comments: comments.filter((c) => c.filePath === filePath(file)).length,
  }));

  const iconButton =
    'grid size-8 place-items-center rounded-md bg-panel2 text-muted hover:bg-line hover:text-ink';

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-accent text-on-accent">
              <GitCompareIcon className="size-3.5" strokeWidth={2.5} />
            </span>
            <h1 className="text-sm font-semibold tracking-tight">{repo.name}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <BranchSelect value={base} branches={repo.branches} onChange={setBase} />
            <span className="font-mono text-xs text-faint">→</span>
            <BranchSelect value={head} branches={repo.branches} onChange={setHead} />
          </div>

          <span className="text-xs text-muted tnum">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>

          <span className="grow" />

          <div className="flex items-center rounded-md bg-panel2 p-0.5">
            {[
              ['unified', Rows3Icon, 'Unified view'],
              ['split', Columns2Icon, 'Split view'],
            ].map(([type, Icon, label]) => (
              <button
                key={type}
                title={label}
                onClick={() => setViewType(type)}
                className={`grid size-7 place-items-center rounded ${
                  viewType === type ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>

          <button
            title={dark ? 'Light theme' : 'Dark theme'}
            onClick={() => setDark(!dark)}
            className={iconButton}
          >
            {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          </button>

          <button
            onClick={onGenerate}
            disabled={comments.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SparklesIcon className="size-4" />
            Generate prompt
            {comments.length > 0 && (
              <span className="rounded bg-black/15 px-1.5 text-xs tnum">{comments.length}</span>
            )}
          </button>
        </div>
        <div className="border-t border-line px-4 py-2">
          <CommitBar commits={commits} view={view} mode={mode} onView={setView} onMode={setMode} />
        </div>
      </header>

      {error && (
        <p className="mx-4 mt-4 rounded-md border border-del/30 bg-del/10 px-3 py-2 font-mono text-xs text-del">
          {error}
        </p>
      )}

      <main className="mx-auto flex max-w-[1600px] items-start gap-5 p-4">
        <nav className="sticky top-28 max-h-[calc(100vh-8rem)] w-72 shrink-0 overflow-y-auto rounded-lg border border-line bg-panel p-2">
          <p className="eyebrow px-2 pb-2 pt-1">Changed files</p>
          <FileTree entries={treeEntries} />
        </nav>
        <div className="min-w-0 flex-1">
          {files.map((file) => (
            <FileDiff
              key={filePath(file)}
              file={file}
              viewType={viewType}
              comments={comments.filter((c) => c.filePath === filePath(file))}
              onCreate={onCreateComment}
              onUpdate={onUpdateComment}
              onDelete={onDeleteComment}
            />
          ))}
          {files.length === 0 && (
            <div className="grid place-items-center rounded-lg border border-dashed border-line py-24 text-center">
              <p className="text-sm text-muted">No changes between these branches.</p>
              <p className="mt-1 font-mono text-xs text-faint">Pick a different base or compare branch.</p>
            </div>
          )}
        </div>
      </main>

      {prompt !== null && (
        <PromptModal
          text={prompt}
          summary={summary}
          onSummaryChange={setSummary}
          onRegenerate={onGenerate}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  );
}
