import { authorizeCrmOwner } from "@/lib/crm-auth";
import { connection } from "@/lib/microsoft/graph";
import { ensureSubscription, syncMail } from "@/lib/microsoft/sync";
import { pullLinkedAppointments, syncAppointment } from "@/lib/microsoft/calendar";
import { env } from "cloudflare:workers";
export async function POST() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied; const user = auth.user;
  const row=await connection(); if(!row || row.owner_user_id!==user.userId) return Response.json({error:"Connect your Microsoft 365 mailbox first"},{status:403});
  try { let notificationsActive=true; try {await ensureSubscription(row)} catch {notificationsActive=false} const result=await syncMail(row); const calendar=await pullLinkedAppointments(); const pending=(await env.DB.prepare("SELECT id FROM tasks WHERE type='Appointment' AND due_time IS NOT NULL AND calendar_sync_status IN ('failed','pending') ORDER BY id DESC LIMIT 20").all<{id:number}>()).results; for(const a of pending) await syncAppointment(a.id); return Response.json({ok:true,notificationsActive,calendar,...result}); }
  catch { return Response.json({error:"Microsoft 365 sync failed. Reconnect the mailbox if it continues."},{status:502}); }
}
