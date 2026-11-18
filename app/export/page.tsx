"use client";
// Private export page (design note 0001). Copies every table and stored file
// into a folder Brad picks on his computer, then writes a report.
// It only reads from the CRM. Requests run one at a time on purpose so live
// Telnyx calls and texts never wait behind the export.
import { useEffect, useRef, useState } from "react";
import { buildReport, safeFilePath } from "@/lib/export/core.mjs";

type Dir = FileSystemDirectoryHandle;
type Inventory = { startedAt: string; tables: { name: string; rows: number }[]; telnyxOnlyRecordings: number };
type FileInfo = { key: string; size: number; etag: string; uploaded: string };

declare global {
  interface Window { showDirectoryPicker?: (opts?: { mode?: "readwrite" }) => Promise<Dir> }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new Error("Not signed in as the CRM owner. Sign in and reload this page.");
  if (!res.ok) throw new Error(`${url} failed (${res.status})`);
  return res.json() as Promise<T>;
}

// True when the chosen folder has nothing in it yet.
async function isEmpty(dir: Dir): Promise<boolean> {
  const it = (dir as unknown as { keys(): AsyncIterableIterator<string> }).keys();
  return (await it.next()).done === true;
}

async function subdir(root: Dir, parts: string[]): Promise<Dir> {
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
  return dir;
}

// Streams a download straight to disk and returns the bytes written.
async function saveResponse(root: Dir, parts: string[], res: Response): Promise<number> {
  const dir = await subdir(root, parts.slice(0, -1));
  const handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await handle.createWritable();
  if (res.body) await res.body.pipeTo(writable);
  else await writable.close();
  return (await handle.getFile()).size;
}

async function saveText(root: Dir, parts: string[], text: string) {
  await saveResponse(root, parts, new Response(text));
}

// One retry after a short pause covers brief network blips.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch {
    await new Promise((r) => setTimeout(r, 2000));
    return fn();
  }
}

export default function ExportPage() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ ok: boolean; problems: string[] } | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (runningRef.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const say = (line: string) => setLog((l) => [...l, line]);

  async function run() {
    if (typeof window.showDirectoryPicker !== "function") {
      say("This needs Chrome or Edge on a computer.");
      return;
    }
    let root: Dir;
    try { root = await window.showDirectoryPicker({ mode: "readwrite" }); } catch { return; }
    if (!(await isEmpty(root))) {
      say("That folder isn't empty. Pick or create an empty folder.");
      return;
    }
    setRunning(true); runningRef.current = true; setResult(null); setLog([]);
    const failures: string[] = [];
    try {
      const inv = await getJson<Inventory>("/api/export/inventory");
      say(`Found ${inv.tables.length} tables and ${inv.telnyxOnlyRecordings} Telnyx-only recordings.`);

      // 1. Tables, written as tables/<name>.json (a JSON array of rows).
      const writtenTables: Record<string, number> = {};
      const tablesDir = await subdir(root, ["tables"]);
      for (const t of inv.tables) {
        const handle = await tablesDir.getFileHandle(`${t.name}.json`, { create: true });
        const out = await handle.createWritable();
        await out.write("[\n");
        let after = 0, count = 0;
        for (;;) {
          const batch = await withRetry(() => getJson<{ rows: unknown[]; next: number | null }>(`/api/export/table?name=${encodeURIComponent(t.name)}&after=${after}`));
          for (const row of batch.rows) {
            await out.write((count ? ",\n" : "") + JSON.stringify(row));
            count += 1;
          }
          if (batch.next === null) break;
          after = batch.next;
        }
        await out.write("\n]\n");
        await out.close();
        writtenTables[t.name] = count;
        say(`Table ${t.name}: ${count} rows`);
      }

      // 2. Stored files, written to files/<same path as in R2>.
      const expectedFiles: FileInfo[] = [];
      let cursor: string | null = null;
      do {
        const page: { objects: FileInfo[]; cursor: string | null } = await withRetry(() => getJson(`/api/export/files${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`));
        expectedFiles.push(...page.objects);
        cursor = page.cursor;
      } while (cursor);
      say(`Copying ${expectedFiles.length} stored files...`);
      const writtenFiles: { key: string; size: number; path: string }[] = [];
      for (const [i, f] of expectedFiles.entries()) {
        try {
          const parts = ["files", ...safeFilePath(f.key)];
          const size = await withRetry(async () => {
            const res = await fetch(`/api/export/file?key=${encodeURIComponent(f.key)}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`status ${res.status}`);
            return saveResponse(root, parts, res);
          });
          writtenFiles.push({ key: f.key, size, path: parts.join("/") });
        } catch (e) {
          failures.push(`File failed: ${f.key} (${(e as Error).message})`);
        }
        if ((i + 1) % 25 === 0) say(`  ${i + 1} of ${expectedFiles.length} files`);
      }

      // 3. Recordings that only exist at Telnyx.
      const recordings = { saved: 0, gone: [] as number[] };
      let after: number | null = 0;
      const ids: number[] = [];
      while (after !== null) {
        const page: { ids: number[]; next: number | null } = await withRetry(() => getJson(`/api/export/recordings?after=${after}`));
        ids.push(...page.ids);
        after = page.next;
      }
      if (ids.length) say(`Downloading ${ids.length} recordings from Telnyx...`);
      for (const id of ids) {
        try {
          await withRetry(async () => {
            const res = await fetch(`/api/export/recording?id=${id}`, { cache: "no-store" });
            if (res.status === 410 || res.status === 404) { recordings.gone.push(id); return; }
            if (!res.ok) throw new Error(`status ${res.status}`);
            const ext = (res.headers.get("content-type") || "").includes("wav") ? "wav" : "mp3";
            await saveResponse(root, ["telnyx-recordings", `${id}.${ext}`], res);
            recordings.saved += 1;
          });
        } catch (e) {
          failures.push(`Telnyx recording failed: communication ${id} (${(e as Error).message})`);
        }
      }

      // 4. Manifest and report.
      const finishedAt = new Date().toISOString();
      const report = buildReport({ startedAt: inv.startedAt, finishedAt, expectedTables: inv.tables, writtenTables, expectedFiles, writtenFiles, recordings, failures });
      await saveText(root, ["manifest.json"], JSON.stringify({ startedAt: inv.startedAt, finishedAt, tables: inv.tables, writtenTables, files: expectedFiles, writtenFiles, recordings, failures }, null, 2));
      await saveText(root, ["report.txt"], report.text);
      setResult({ ok: report.ok, problems: report.problems });
      say(report.ok ? "Done. Everything was copied. Open report.txt in the folder." : `Done with ${report.problems.length} problems. See report.txt.`);
    } catch (e) {
      say(`Stopped: ${(e as Error).message}`);
      setResult({ ok: false, problems: [(e as Error).message] });
    } finally {
      setRunning(false); runningRef.current = false;
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Export CRM data</h1>
      <p className="text-sm text-muted-foreground">
        Copies every table and stored file into a folder on this computer, then writes report.txt. It only reads from the CRM.
        Pick an empty folder in Dropbox and keep this tab open until it finishes.
      </p>
      <button onClick={run} disabled={running} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
        {running ? "Exporting..." : "Choose folder and export"}
      </button>
      {result && (
        <p className={`rounded-md border p-3 text-sm ${result.ok ? "border-green-600" : "border-red-600"}`}>
          {result.ok ? "Complete. Every row and file was copied." : `${result.problems.length} problem(s). Details are in report.txt.`}
        </p>
      )}
      {log.length > 0 && (
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{log.join("\n")}</pre>
      )}
    </main>
  );
}
