// Short overlapping excerpts preserve context without embedding a whole thread.
export function chunksOf(value, size = 900, overlap = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const result = [];
  for (let start = 0; start < text.length && result.length < 32;) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) { const space = text.lastIndexOf(' ', end); if (space > start + size / 2) end = space; }
    result.push(text.slice(start, end));
    if (end === text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return result;
}
export function redactSecrets(text) {
  return String(text || '')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[redacted]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~-]{16,})\b/gi, '[redacted]')
    .replace(/\b(?:api[_ -]?key|client[_ -]?secret|access[_ -]?token|refresh[_ -]?token|password)\s*[:=]\s*[^\s,;]+/gi, '[redacted]');
}
