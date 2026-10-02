import { env } from "cloudflare:workers";

export type StoredImage = { url: string; content_type: string; size: number };
const keyFor = (token: string) => `sms-media/${token}`;

export function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return "image/png";
  if (bytes.length >= 6 && new TextDecoder().decode(bytes.subarray(0,6)).match(/^GIF8[79]a$/)) return "image/gif";
  return null;
}

export async function storeImage(bytes: Uint8Array, origin: string): Promise<StoredImage> {
  const contentType = imageType(bytes);
  if (!contentType) throw new Error("Only JPG, PNG, and GIF images are supported.");
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2,"0")).join("");
  await env.FILES.put(keyFor(token), bytes, { httpMetadata: { contentType } });
  return { url: `${origin}/api/telnyx/media/${token}`, content_type: contentType, size: bytes.byteLength };
}

export async function storedImage(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return env.FILES.get(keyFor(token));
}

export async function isStoredImageUrl(value: string, origin: string) {
  const prefix = `${origin}/api/telnyx/media/`;
  if (!value.startsWith(prefix)) return false;
  const token = value.slice(prefix.length);
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  return Boolean(await env.FILES.head(keyFor(token)));
}

export async function archiveInboundImages(media: unknown, origin: string): Promise<StoredImage[]> {
  if (!Array.isArray(media)) return [];
  const images: StoredImage[] = [];
  for (const item of media.slice(0,10)) {
    const value = item as { url?: unknown; content_type?: unknown };
    if (typeof value.url !== "string") continue;
    let url: URL;
    try { url = new URL(value.url); } catch { continue; }
    if (url.protocol !== "https:" || !(url.hostname === "telnyx.com" || url.hostname.endsWith(".telnyx.com"))) continue;
    try {
      const response = await fetch(url.toString());
      if (!response.ok || Number(response.headers.get("content-length") || 0) > 5_000_000) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 5_000_000 || !imageType(bytes)) continue;
      images.push(await storeImage(bytes, origin));
    } catch { /* A broken Telnyx media link must not discard the text. */ }
  }
  return images;
}
