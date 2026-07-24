import { useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlus2Icon,
  FileMinus2Icon,
  FilePenIcon,
  FileDiffIcon,
  FolderIcon,
  FolderOpenIcon,
} from 'lucide-react';

function buildTree(entries) {
  const root = { dirs: new Map(), files: [] };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push({ ...entry, name: parts[parts.length - 1] });
  }
  return root;
}

function StatusIcon({ type }) {
  const cls = 'size-3.5 shrink-0';
  if (type === 'add') return <FilePlus2Icon className={clsx(cls, 'text-add')} />;
  if (type === 'delete') return <FileMinus2Icon className={clsx(cls, 'text-del')} />;
  if (type === 'rename') return <FilePenIcon className={clsx(cls, 'text-accent')} />;
  return <FileDiffIcon className={clsx(cls, 'text-muted')} />;
}

function FileRow({ file, depth, onToggleReviewed }) {
  return (
    <div
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      className={clsx('group flex items-center gap-1.5 rounded-md pr-2 hover:bg-panel2', file.reviewed && 'opacity-55')}
    >
      <input
        type="checkbox"
        checked={!!file.reviewed}
        onChange={() => onToggleReviewed(file.path)}
        title="Mark viewed"
        className="shrink-0 accent-accent"
      />
      <a
        href={`#${file.path}`}
        title={file.path}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 font-mono text-xs text-muted hover:text-ink"
      >
        <StatusIcon type={file.type} />
        <span className="truncate">{file.name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[0.6875rem] tnum">
          {file.comments > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-accent-soft text-accent">{file.comments}</span>
          )}
          {file.adds > 0 && <span className="text-add">+{file.adds}</span>}
          {file.dels > 0 && <span className="text-del">−{file.dels}</span>}
        </span>
      </a>
    </div>
  );
}

function Directory({ name, node, depth, onToggleReviewed }) {
  const [open, setOpen] = useState(true);
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;
  const Folder = open ? FolderOpenIcon : FolderIcon;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 font-mono text-xs text-muted hover:bg-panel2 hover:text-ink"
      >
        <Chevron className="size-3.5 shrink-0" />
        <Folder className="size-3.5 shrink-0 text-accent" />
        <span className="truncate">{name}</span>
      </button>
      {open && <TreeLevel node={node} depth={depth + 1} onToggleReviewed={onToggleReviewed} />}
    </div>
  );
}

function TreeLevel({ node, depth, onToggleReviewed }) {
  return (
    <>
      {[...node.dirs.entries()].map(([name, child]) => (
        <Directory key={name} name={name} node={child} depth={depth} onToggleReviewed={onToggleReviewed} />
      ))}
      {node.files.map((file) => (
        <FileRow key={file.path} file={file} depth={depth} onToggleReviewed={onToggleReviewed} />
      ))}
    </>
  );
}

export default function FileTree({ entries, onToggleReviewed }) {
  if (entries.length === 0) {
    return <p className="px-2 py-1 font-mono text-xs text-faint">No changes</p>;
  }
  return <TreeLevel node={buildTree(entries)} depth={0} onToggleReviewed={onToggleReviewed} />;
}
