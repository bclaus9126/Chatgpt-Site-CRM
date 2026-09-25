import { env } from "cloudflare:workers";

const GRAPH = "https://graph.microsoft.com/v1.0";
export const MAILBOX = String((env as unknown as Record<string, string>).MS_MAILBOX || "").trim().toLowerCase();
export const ORIGIN = "https://claus-crm.bclaus.chatgpt.site";
export const CALLBACK = `${ORIGIN}/api/microsoft/callback`;
export const SCOPE = "offline_access User.Read Mail.Read";
export const SEND_SCOPE = `${SCOPE} Mail.Send Calendars.ReadWrite`;

type Configuration = Cloudflare.Env & { MS_CLIENT_ID?: string; MS_CLIENT_SECRET?: string; MS_TENANT_ID?: string; MS_TOKEN_KEY?: string };
export const config = () => env as Configuration;
export function configured() { const c=config(); return !!(c.MS_CLIENT_ID && c.MS_CLIENT_SECRET && c.MS_TENANT_ID && c.MS_TOKEN_KEY && MAILBOX); }
export const authority = () => `https://login.microsoftonline.com/${encodeURIComponent(config().MS_TENANT_ID || "organizations")}/oauth2/v2.0`;
export const random = (length=32) => { const bytes = crypto.getRandomValues(new Uint8Array(length)); return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); };
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const challenge = async (verifier: string) => base64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
async function key() { const raw = config().MS_TOKEN_KEY; if (!raw) throw Error("Microsoft token encryption is not configured"); const bytes=Uint8Array.from(atob(raw), x=>x.charCodeAt(0)); if(bytes.length!==32) throw Error("Invalid token encryption key"); return crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["encrypt","decrypt"]); }
export async function seal(value: string) { const iv=crypto.getRandomValues(new Uint8Array(12)); const data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(value))); return `${base64(iv)}.${base64(data)}`; }
export async function unseal(value: string) { const [iv,data]=value.split("."); if(!iv||!data) throw Error("Invalid stored token"); return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:Uint8Array.from(atob(iv),x=>x.charCodeAt(0))},await key(),Uint8Array.from(atob(data),x=>x.charCodeAt(0)))); }
export type Tokens = { access_token:string; refresh_token?:string; expires_in:number; scope?:string; error?:string; error_description?:string };
export async function exchange(fields: Record<string,string>): Promise<Tokens> { const c=config(); const response=await fetch(`${authority()}/token`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.MS_CLIENT_ID || "",client_secret:c.MS_CLIENT_SECRET || "",scope:SCOPE,...fields})}); const data=await response.json() as Tokens; if(!response.ok || !data.access_token) throw Error(`Microsoft authorization failed: ${data.error || response.status}`); return data; }
export type Connection = { id:number; owner_user_id:string; mailbox:string; graph_user_id:string; encrypted_refresh_token:string; send_enabled:number; calendar_enabled:number; subscription_id:string|null; client_state:string|null; subscription_expires_at:string|null; last_synced_at:string|null };
export async function connection() { return env.DB.prepare("SELECT * FROM microsoft_mail_connections WHERE mailbox=?").bind(MAILBOX).first<Connection>(); }
export async function accessToken(row:Connection) { const token=await exchange({grant_type:"refresh_token",refresh_token:await unseal(row.encrypted_refresh_token),scope:row.calendar_enabled?SEND_SCOPE:row.send_enabled?`${SCOPE} Mail.Send`:SCOPE}); if(token.refresh_token) await env.DB.prepare("UPDATE microsoft_mail_connections SET encrypted_refresh_token=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(await seal(token.refresh_token),row.id).run(); return token.access_token; }
export async function graph<T>(token:string,path:string,init:RequestInit={}):Promise<T> { const url=path.startsWith(GRAPH) ? path : `${GRAPH}${path}`; if(!url.startsWith(`${GRAPH}/`)) throw Error("Invalid Microsoft Graph URL"); const response=await fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,"content-type":"application/json",Prefer:'IdType="ImmutableId"',...init.headers}}); if(!response.ok) throw Error(`Microsoft Graph ${response.status}`); return response.status===204 ? undefined as T : await response.json() as T; }
