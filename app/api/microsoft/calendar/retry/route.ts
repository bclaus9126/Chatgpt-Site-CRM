import { authorizeCrmOwner } from "@/lib/crm-auth";
import { syncAppointment } from "@/lib/microsoft/calendar";
import { env } from "cloudflare:workers";
export async function POST(request:Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const {id}=await request.json() as {id:number};
  if(!Number.isInteger(id)) return Response.json({error:"Invalid appointment"},{status:400});
  const row=await env.DB.prepare("SELECT id FROM tasks WHERE id=? AND type='Appointment'").bind(id).first();
  if(!row) return Response.json({error:"Appointment not found"},{status:404});
  await syncAppointment(id);
  const status=await env.DB.prepare("SELECT calendar_sync_status,calendar_sync_error FROM tasks WHERE id=?").bind(id).first();
  return Response.json(status);
}
