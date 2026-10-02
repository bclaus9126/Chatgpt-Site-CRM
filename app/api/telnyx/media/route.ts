import { authorizeCrmOwner } from "@/lib/crm-auth";
import { storeImage } from "@/lib/telnyx-media";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0 || file.size > 550_000)
    return Response.json({ error: "Choose an image under 550 KB." }, { status: 400 });
  try {
    const image = await storeImage(new Uint8Array(await file.arrayBuffer()), new URL(request.url).origin);
    return Response.json(image);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not upload image." }, { status: 400 });
  }
}
