import { env } from "cloudflare:workers";

export type StoredImage = { url: string; content_type: string; size: number; source_url?: string };
export type MediaFailure = { reason: string; content_type: string };
const keyFor = (token: string) => `sms-media/${token}`;
const MAX_BYTES = 5_000_000;

export function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return "image/png";
  if (bytes.length >= 6 && new TextDecoder().decode(bytes.subarray(0,6)).match(/^GIF8[79]a$/)) return "image/gif";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0,4)) === "RIFF" && new TextDecoder().decode(bytes.subarray(8,12)) === "WEBP") return "image/webp";
  if (bytes.length >= 14 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  return null;
}
function attachmentType(bytes: Uint8Array): string | null {
  if (new TextDecoder().decode(bytes.subarray(0,5)) === "%PDF-") return "application/pdf";
  return imageType(bytes);
}

export async function storeImage(bytes: Uint8Array, origin: string, allowDocument = false): Promise<StoredImage> {
  const contentType = allowDocument ? attachmentType(bytes) : imageType(bytes);
  if (!contentType) throw new Error("Unsupported attachment format. Use JPG, PNG, GIF, WebP, BMP, or PDF.");
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

// Only provider media hosts are fetched; never forward API credentials to a CDN.
export function allowedMediaUrl(value: string): URL | null {
  try {
    const url = new URL(value), host = url.hostname.toLowerCase();
    const allowed = host === "telnyx.com" || host.endsWith(".telnyx.com") || host === "telnyx-cdn.com" || host.endsWith(".telnyx-cdn.com") || host === "s3.amazonaws.com" || host.endsWith(".s3.amazonaws.com") || /^[a-z0-9.-]+\.s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host);
    return allowed && url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") ? url : null;
  } catch { return null; }
}
async function downloadMedia(value: string): Promise<Uint8Array> {
  let url = allowedMediaUrl(value);
  for (let redirects=0; redirects<4; redirects++) {
    if (!url) throw Error("Attachment host is not supported.");
    const response = await fetch(url.toString(), {redirect:"manual",signal:AbortSignal.timeout(12000)});
    if ([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get("location");
      if(!location)throw Error("Attachment redirect is missing.");
      url=allowedMediaUrl(new URL(location,url).toString());continue;
    }
    if (!response.ok) throw Error(`Attachment download failed (HTTP ${response.status}).`);
    if(Number(response.headers.get("content-length")||0)>MAX_BYTES)throw Error("Attachment exceeds 5 MB.");
    const reader=response.body?.getReader();if(!reader)throw Error("Attachment is empty.");
    const chunks:Uint8Array[]=[];let size=0;
    try { for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw Error("Attachment exceeds 5 MB.");chunks.push(value);} }
    catch(error){await reader.cancel();throw error;}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
  }
  throw Error("Too many attachment redirects.");
}
export async function archiveInboundMedia(media: unknown, origin: string, existing:StoredImage[] = []) {
  const images:StoredImage[]=[...existing],failures:MediaFailure[]=[];
  const sources=Array.isArray(media)?media.slice(0,10):[];
  let expected=0;
  for(const raw of sources){
    const item=raw as {url?:unknown;content_type?:unknown};
    const contentType=String(item?.content_type||"");
    // Carrier presentation files accompany pictures but aren't attachments to display.
    if(/^(application\/smil|text\/plain)(?:;|$)/i.test(contentType))continue;
    expected++;
    if(typeof item?.url!=="string"){failures.push({reason:"Attachment URL is missing.",content_type:contentType});continue;}
    if(images.some(image=>image.source_url===item.url))continue;
    try {const bytes=await downloadMedia(item.url);images.push({...await storeImage(bytes,origin,true),source_url:item.url});}
    catch(error){const reason=error instanceof Error && /^(Attachment|Unsupported|Too many)/.test(error.message)?error.message:"Attachment could not be downloaded. Try recovering it again.";failures.push({reason,content_type:contentType});}
  }
  if(failures.length)console.error("Inbound MMS attachment archive incomplete",{expected,saved:images.length,failures:failures.map(x=>x.reason)});
  return {media:images,media_expected:expected,media_failures:failures,media_checked_at:new Date().toISOString()};
}
// Compatibility for callers that only need stored image objects.
export async function archiveInboundImages(media: unknown, origin: string): Promise<StoredImage[]> {
  return (await archiveInboundMedia(media,origin)).media;
}
