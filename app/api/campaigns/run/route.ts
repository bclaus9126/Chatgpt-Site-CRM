import { runDue } from '@/lib/campaign';
import { authorizeCrmOwner } from '@/lib/crm-auth';
export const dynamic='force-dynamic';
export async function POST() {
  const auth=await authorizeCrmOwner();if(auth.denied)return auth.denied;
  try {return Response.json(await runDue(50,true));}catch{return Response.json({error:'Campaign test run failed'},{status:500});}
}
