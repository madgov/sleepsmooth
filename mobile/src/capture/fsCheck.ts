// Lists the app's Documents and Caches directories (recursively) and flags anything that looks like audio.
// Run it after a capture session: the expectation is that no audio file exists.
import { Directory, File, Paths } from 'expo-file-system';

const AUDIO_EXT = new Set(['wav', 'caf', 'm4a', 'mp3', 'aac', 'aiff', 'aif', 'flac', 'ogg', 'opus', 'pcm', 'raw', 'mp4', 'amr', '3gp']);
const LARGE_BYTES = 1_000_000;

export interface FsEntry {
  path: string;
  size: number | null;
  suspicious: boolean;
  reason: string | null;
}
export interface FsReport {
  roots: { label: string; uri: string; entries: FsEntry[]; error: string | null }[];
  suspiciousCount: number;
  fileCount: number;
}

function walk(dir: Directory, rootUri: string, out: FsEntry[], depth = 0): void {
  if (depth > 8 || out.length > 500) return;
  let children: (Directory | File)[];
  try {
    children = dir.list();
  } catch {
    return;
  }
  for (const c of children) {
    const rel = c.uri.startsWith(rootUri) ? c.uri.slice(rootUri.length) : c.uri;
    if (c instanceof Directory) {
      walk(c, rootUri, out, depth + 1);
    } else {
      const size = c.size ?? null;
      const ext = (c.extension ?? '').replace('.', '').toLowerCase();
      const audioExt = AUDIO_EXT.has(ext);
      const large = size !== null && size >= LARGE_BYTES;
      out.push({ path: rel, size, suspicious: audioExt || large, reason: audioExt ? 'audio-like extension' : large ? `file >= ${LARGE_BYTES} bytes` : null });
    }
  }
}

export function checkAppStorage(): FsReport {
  const roots = [
    { label: 'Documents', dir: Paths.document },
    { label: 'Caches', dir: Paths.cache },
  ].map(({ label, dir }) => {
    const entries: FsEntry[] = [];
    let error: string | null = null;
    try {
      walk(dir, dir.uri, entries);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    return { label, uri: dir.uri, entries, error };
  });
  const all = roots.flatMap((r) => r.entries);
  return { roots, suspiciousCount: all.filter((e) => e.suspicious).length, fileCount: all.length };
}

export function formatFsReport(r: FsReport): string {
  const lines: string[] = [];
  for (const root of r.roots) {
    lines.push(`${root.label}: ${root.entries.length} file(s)${root.error ? ` (error: ${root.error})` : ''}`);
    for (const e of root.entries.slice(0, 60)) lines.push(`  ${e.suspicious ? '!! ' : '   '}${e.path} ${e.size ?? '?'} B${e.reason ? ` <- ${e.reason}` : ''}`);
    if (root.entries.length > 60) lines.push(`  ... ${root.entries.length - 60} more`);
  }
  lines.push(r.suspiciousCount === 0 ? 'No audio-like or large files found in Documents or Caches.' : `${r.suspiciousCount} audio-like or large file(s) found. Investigate before claiming audio is not saved.`);
  return lines.join('\n');
}
