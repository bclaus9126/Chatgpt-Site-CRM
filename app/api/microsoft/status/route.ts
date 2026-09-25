import { authorizeCrmOwner } from "@/lib/crm-auth";
import { configured, connection, MAILBOX } from "@/lib/microsoft/graph";
export async function GET() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied; const user = auth.user;
  const row=await connection();
  return Response.json({configured:configured(),connected:!!row && row.owner_user_id===user.userId,canSend:!!row?.send_enabled && row.owner_user_id===user.userId,calendarEnabled:!!row?.calendar_enabled && row.owner_user_id===user.userId,mailbox:MAILBOX,lastSyncedAt:row?.owner_user_id===user.userId ? row.last_synced_at:null,notificationsActive:row?.owner_user_id===user.userId && !!row.subscription_expires_at && Date.parse(row.subscription_expires_at)>Date.now(),notificationExpiresAt:row?.owner_user_id===user.userId ? row.subscription_expires_at:null,ownedByAnotherAccount:!!row && row.owner_user_id!==user.userId},{headers:{"cache-control":"no-store"}});
}
