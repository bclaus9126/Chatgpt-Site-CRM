import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { relationshipOptions, intentOptions, stageOptions, fromFubStage } from "@/lib/contact-classification";
import { NextResponse } from "next/server";
import { syncAppointment } from "@/lib/microsoft/calendar";
import { formatContactAddress } from "@/lib/contact-address";
async function load(db: D1Database) {
  const [
    contacts,
    opportunities,
    tasks,
    notes,
    communications,
    properties,
    activities,
    relationships,
    intelligence,
    relationshipMoments,
    communicationSuggestions,
  ] = await Promise.all([
    db
      .prepare(
        "SELECT * FROM contacts ORDER BY CASE temperature WHEN 'Hot' THEN 1 WHEN 'Warm' THEN 2 ELSE 3 END,next_follow_up",
      )
      .all(),
    db
      .prepare(
        "SELECT o.*,c.first_name||' '||c.last_name contact_name FROM opportunities o JOIN contacts c ON c.id=o.contact_id ORDER BY o.updated_at DESC",
      )
      .all(),
    db
      .prepare(
        "SELECT t.*,c.first_name||' '||c.last_name contact_name FROM tasks t LEFT JOIN contacts c ON c.id=t.contact_id ORDER BY status='Completed',due_date,due_time",
      )
      .all(),
    db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all(),
    db
      .prepare(
        `SELECT id,contact_id,type,direction,occurred_at,subject,message_transcript,duration_seconds,recording_id,ai_summary,call_outcome,follow_up_suggestion,external_provider_id,from_number,to_number,caller_number,destination_number,brad_cell_number,business_number,call_control_id,call_leg_id,related_call_leg_ids,started_at,answered_at,bridged_at,ended_at,status,audio_object_key,audio_content_type,interaction_type,author_name,participants,imported,original_imported_text,transcription_status,transcript_timestamps,analysis_status,source_system,source_record_id,is_sample FROM communications ORDER BY occurred_at DESC`,
      )
      .all(),
    db.prepare("SELECT * FROM properties ORDER BY created_at DESC").all(),
    db.prepare("SELECT * FROM activities ORDER BY occurred_at DESC").all(),
    db.prepare("SELECT * FROM contact_relationships ORDER BY id DESC").all(),
    db.prepare("SELECT * FROM contact_intelligence WHERE status='Current' ORDER BY source_date DESC,id DESC").all(),
    db.prepare("SELECT * FROM relationship_moments ORDER BY date_value").all(),
    db.prepare("SELECT * FROM communication_suggestions ORDER BY id").all(),
  ]);
  return {
    contacts: contacts.results,
    opportunities: opportunities.results,
    tasks: tasks.results,
    notes: notes.results,
    communications: communications.results,
    properties: properties.results,
    activities: activities.results,
    relationships: relationships.results,
    intelligence: intelligence.results,
    relationshipMoments: relationshipMoments.results,
    communicationSuggestions: communicationSuggestions.results,
  };
}
export async function GET() {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  try {
    return NextResponse.json(await load(env.DB));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "CRM data is temporarily unavailable." },
      { status: 500 },
    );
  }
}
export async function POST(req: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  try {
    const b = (await req.json()) as Record<string, any>,
      db = env.DB;
    const fields = (names: string[]) => Object.fromEntries(names.map(name => [name, b[name] === "" ? null : b[name] ?? null]));
    const save = async (table: "contacts" | "tasks" | "opportunities", id: number, changes: Record<string, unknown>) => {
      const keys = Object.keys(changes);
      await db.prepare(`UPDATE ${table} SET ${keys.map(k => `${k}=?`).join(",")},updated_at=CURRENT_TIMESTAMP,updated_by='Brad Claus',update_source='manual' WHERE id=?`)
        .bind(...keys.map(k => changes[k]), id).run();
    };
    const validEmail = (value: unknown) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    const validPhone = (value: unknown) => !value || /^[+()\d.\s-]{7,24}$/.test(String(value));
    if (b.action === "editContact") {
      if (!Number.isInteger(b.id) || !String(b.first_name || "").trim() || !String(b.last_name || "").trim() || !validEmail(b.email) || !validPhone(b.phone)) return NextResponse.json({error:"Check name, phone and email."},{status:400});
      const extras = (raw: unknown, validator: (v: unknown) => boolean) => String(raw || "").split("\n").map(v => v.trim()).filter(Boolean).every(v => validator(v.split("|")[0].trim()));
      if (!extras(b.additional_phones, validPhone) || !extras(b.additional_emails, validEmail)) return NextResponse.json({error:"Check additional phone numbers and email addresses."},{status:400});
      const keys = ["first_name","last_name","display_name","phone","additional_phones","phone_type","email","additional_emails","email_type","address","property_address","relationship","intent","stage","lead_source","temperature","tags","birthday","spouse_name","contextual_notes"];
      const changes = fields(keys);
      if (["addressStreet","addressCity","addressState","addressZip","addressCountry"].some(key => key in b)) {
        const existing = await db.prepare("SELECT address FROM contacts WHERE id=?").bind(b.id).first<{address:string|null}>();
        const formatted = formatContactAddress(b);
        // An untouched legacy address remains byte-for-byte intact.
        changes.address = b.originalAddress === existing?.address && b.addressEdited !== true ? existing?.address : formatted || null;
      }
      await save("contacts", b.id, changes);
    }
    if (b.action === "saveAppointment" || b.action === "saveTask") {
      if (!Number.isInteger(b.contactId) || !String(b.title || "").trim()) return NextResponse.json({error:"Choose a contact and title."},{status:400});
      const appointment = b.action === "saveAppointment";
      if (appointment && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate || ""))) return NextResponse.json({error:"Choose a date."},{status:400});
      const details = JSON.stringify({precision:b.precision || (b.dueTime ? "exact" : "date only"),endTime:b.endTime || null,daypart:b.daypart || null,location:b.location || null,propertyAddress:b.propertyAddress || null,reminder:b.reminder || null,commitment:!!b.commitment,inviteContact:!!b.inviteContact});
      if (appointment && b.precision === "exact" && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.dueTime||"")) || b.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.endTime)))) return NextResponse.json({error:"Enter a valid start and end time."},{status:400});
      if (appointment && b.inviteContact) { const contact=await db.prepare("SELECT email FROM contacts WHERE id=?").bind(b.contactId).first<{email:string|null}>(); if(!contact?.email) return NextResponse.json({error:"Add the contact's email before inviting them."},{status:400}); }
      if (b.id) await save("tasks", Number(b.id), {title:b.title,type:appointment?"Appointment":b.type||"Task",due_date:b.dueDate||null,due_time:b.precision === "exact" ? b.dueTime||null : null,status:b.status||"Open",notes:b.notes||null,details});
      else { const created=await db.prepare("INSERT INTO tasks (contact_id,title,type,due_date,due_time,status,notes,details,source_system,update_source,updated_by,created_at) VALUES (?,?,?,?,?,?,?,?, 'manual','manual','Brad Claus',CURRENT_TIMESTAMP)").bind(b.contactId,b.title,appointment?"Appointment":b.type||"Task",b.dueDate||null,b.precision === "exact"?b.dueTime||null:null,b.status||"Open",b.notes||null,details).run(); b.id=created.meta.last_row_id; }
      if (appointment) await syncAppointment(Number(b.id));
    }
    if (b.action === "saveTransaction") {
      if (!Number.isInteger(b.contactId) || !["Buyer","Seller"].includes(b.type) || !String(b.stage||"").trim()) return NextResponse.json({error:"Choose a contact, type and stage."},{status:400});
      const detailKeys = ["assignedAgent","createdDate","listPrice","currentPrice","mlsNumber","listingDate","bedrooms","bathrooms","squareFootage","lotSize","yearBuilt","mortgageBalance","sellerPriceExpectation","expectedNetProceeds","closingDate","commission","offerPrice","contractPrice","purchasePrice","earnestMoney","optionFee","financingType","lender","preApprovalAmount"];
      const details = JSON.stringify(Object.fromEntries(detailKeys.map(k => [k,b[k]||null])));
      const changes = {contact_id:b.contactId,type:b.type,stage:b.stage,property_address:b.propertyAddress||null,estimated_price:Number(b.currentPrice||b.contractPrice||b.listPrice||b.offerPrice)||null,notes:b.notes||null,details};
      if (b.id) await save("opportunities",Number(b.id),changes);
      else await db.prepare("INSERT INTO opportunities (contact_id,type,stage,property_address,estimated_price,notes,details,source_system,update_source,updated_by) VALUES (?,?,?,?,?,?,?,'manual','manual','Brad Claus')").bind(...Object.values(changes)).run();
    }
    if (b.action === "updateClassification") {
      const options: Record<string, readonly string[]> = { relationship: relationshipOptions, intent: intentOptions, stage: stageOptions };
      if (!options[b.field]?.includes(b.value) || !Number.isInteger(b.contactId)) return NextResponse.json({ error: "Invalid contact classification" }, { status: 400 });
      await db.prepare(`UPDATE contacts SET ${b.field}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(b.value, b.contactId).run();
    }
    if (b.action === "normalizeFubClassifications") {
      const imported = await db.prepare("SELECT r.contact_id,r.raw_json,c.relationship,c.intent,c.stage FROM import_rows r JOIN contacts c ON c.id=r.contact_id WHERE r.status='Imported' AND c.source_system='follow_up_boss'").all<Record<string,any>>();
      for (const row of imported.results) {
        let source: Record<string,string>; try { source = JSON.parse(row.raw_json); } catch { continue; }
        const oldStage = source.Stage || "", mapped = fromFubStage(oldStage);
        // Update only the exact values set by the old importer. Manual edits remain untouched.
        if (row.relationship !== "Lead" || row.intent !== oldStage || row.stage !== oldStage) continue;
        if (!mapped.stage && !["Past Client", "Sphere"].includes(mapped.relationship)) continue;
        await db.prepare("UPDATE contacts SET relationship=?,intent='None / Unknown',stage=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND relationship='Lead' AND intent=? AND stage=?").bind(mapped.relationship, mapped.stage, row.contact_id, oldStage, oldStage).run();
      }
    }
    if (b.action === "completeTask")
      await db
        .prepare(
          "UPDATE tasks SET status='Completed',completed_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(b.id)
        .run();
    if (b.action === "completeFollowUp" || b.action === "rescheduleFollowUp") {
      if (!Number.isInteger(b.contactId) || (b.action === "rescheduleFollowUp" && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate || "")))) return NextResponse.json({error:"Invalid follow-up"},{status:400});
      await db.prepare("UPDATE contacts SET next_follow_up=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(b.action === "completeFollowUp" ? null : b.dueDate,b.contactId).run();
    }
    if (b.action === "rescheduleTask") {
      if (!Number.isInteger(b.id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.dueDate || ""))) return NextResponse.json({error:"Invalid task date"},{status:400});
      const existing = await db.prepare("SELECT type FROM tasks WHERE id=?").bind(b.id).first<{type:string}>();
      if (!existing) return NextResponse.json({error:"Task not found"},{status:404});
      await db.prepare("UPDATE tasks SET due_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.dueDate,b.id).run();
      if (existing.type === "Appointment") await syncAppointment(b.id);
    }
    if (b.action === "addNote") {
      const r = await db
        .prepare("INSERT INTO notes (contact_id,body,created_at) VALUES (?,?,CURRENT_TIMESTAMP)")
        .bind(b.contactId, b.body)
        .run();
      await db
        .prepare(
          "INSERT INTO activities (contact_id,type,title,detail,source_id) VALUES (?,'note','Note added',?,?)",
        )
        .bind(b.contactId, b.body, r.meta.last_row_id)
        .run();
      await db
        .prepare(
          "UPDATE contacts SET last_meaningful_contact=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(b.contactId)
        .run();
    }
    if (b.action === "addTask")
      await db
        .prepare(
          "INSERT INTO tasks (contact_id,title,type,due_date,due_time,priority,status,notes,created_at) VALUES (?,?,?,?,?,?,'Open',?,CURRENT_TIMESTAMP)",
        )
        .bind(
          b.contactId,
          b.title,
          b.type || "Follow-up",
          b.dueDate,
          b.dueTime || null,
          b.priority || "Normal",
          b.notes || null,
        )
        .run();
    if (b.action === "updateTags") {
      const tags = Array.isArray(b.tags)
        ? b.tags
            .map((tag: unknown) => String(tag).trim())
            .filter(Boolean)
            .slice(0, 50)
            .join(",")
        : "";
      await db
        .prepare(
          "UPDATE contacts SET tags=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .bind(tags || null, b.contactId)
        .run();
    }
    if (b.action === "addContact")
      await db
        .prepare(
          "INSERT INTO contacts (first_name,last_name,phone,email,address,relationship,lead_source,intent,stage,temperature,next_follow_up,recommended_next_action,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          b.firstName,
          b.lastName,
          b.phone || null,
          b.email || null,
          formatContactAddress(b) || null,
          b.relationship || "Lead",
          b.leadSource || null,
          b.intent || "None / Unknown",
          stageOptions.includes(b.stage) ? b.stage : "Lead",
          b.temperature || "Warm",
          b.nextFollowUp || null,
          b.recommendedNextAction || null,
          b.tags || null,
        )
        .run();
    return NextResponse.json(await load(db));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "That change could not be saved. Try again." },
      { status: 500 },
    );
  }
}
