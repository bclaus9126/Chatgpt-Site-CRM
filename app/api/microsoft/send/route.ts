import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { accessToken, connection, MAILBOX, ORIGIN } from "@/lib/microsoft/graph";
import { syncMail } from "@/lib/microsoft/sync";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied; const user = auth.user;
  if (request.headers.get("origin") && request.headers.get("origin") !== ORIGIN) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const row = await connection();
  if (!row || row.owner_user_id !== user.userId) return Response.json({ error: "Connect your Microsoft 365 mailbox first." }, { status: 403 });
  if (!row.send_enabled) return Response.json({ error: "Approve the Mail.Send permission in Microsoft 365 before sending." }, { status: 403 });
  let data: { contactId?: number; to?: string; subject?: string; body?: string };
  try { data = await request.json(); } catch { return Response.json({ error: "Invalid email" }, { status: 400 }); }
  const contactId = Number(data.contactId);
  const to = String(data.to || "").trim().toLowerCase();
  const subject = String(data.subject || "").trim();
  const body = String(data.body || "").trim();
  if (!Number.isInteger(contactId) || contactId <= 0 || !validEmail(to) || !subject || subject.length > 998 || !body || body.length > 100000) return Response.json({ error: "Enter a valid recipient, subject and message." }, { status: 400 });
  const contact = await env.DB.prepare("SELECT email,additional_emails FROM contacts WHERE id=?").bind(contactId).first<{email:string|null;additional_emails:string|null}>();
  if (!contact) return Response.json({ error: "Contact no longer exists." }, { status: 404 });
  const methods = await env.DB.prepare("SELECT normalized_value FROM contact_methods WHERE contact_id=? AND kind='email'").bind(contactId).all<{normalized_value:string}>();
  const addresses = [contact.email, ...(contact.additional_emails || "").split(/\r?\n/).map(item => item.split("|")[0]), ...methods.results.map(item => item.normalized_value)].map(value => String(value || "").trim().toLowerCase());
  if (!addresses.includes(to)) return Response.json({ error: "Recipient is not saved on this contact. Edit the contact first." }, { status: 400 });
  try {
    const token = await accessToken(row);
    const result = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ message: { subject, body: { contentType: "Text", content: body }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true }) });
    if (!result.ok) {
      if (result.status === 403) return Response.json({ error: "Microsoft has not granted permission to send mail. Reconnect Microsoft 365 and approve Mail.Send." }, { status: 403 });
      return Response.json({ error: `Microsoft could not accept the email (${result.status}). It was not added to the CRM.` }, { status: 502 });
    }
    // Graph accepts a send with HTTP 202 and records the message in Sent Items asynchronously.
    // Use the existing importer for the timeline and avoid inventing a second, duplicate email record.
    let synced = false;
    try { await syncMail(row); synced = true; } catch (error) { console.error("Sent email sync failed", error); }
    return Response.json({ ok: true, from: MAILBOX, synced });
  } catch (error) {
    console.error("Microsoft send failed before acceptance", error);
    return Response.json({ error: "Could not send through Microsoft 365. Please try again." }, { status: 502 });
  }
}
