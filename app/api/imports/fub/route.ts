import { authorizeCrmOwner } from "@/lib/crm-auth";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import {
  contactName, isFollowUpBoss, isSupportedColumn, parseFubCommunications,
  normalizeEmail, normalizePhone, parseCsv, type FubRow,
} from "@/lib/fub-import";
import { fromFubStage } from "@/lib/contact-classification";
import { formatContactAddress } from "@/lib/contact-address";

const SOURCE = "follow_up_boss";
const buyerFields = ["Price Min", "Price Max", "Price Ceiling", "Target Areas", "Target ZIPs", "Bedrooms Needed", "Bathrooms Needed", "Garage Size Needed", "Lot Size Preference", "Minimum Square Footage", "Specific Schools", "Must-Haves", "Nice-to-Haves", "Deal-Breakers", "Commute Anchor Address", "Max Commute Time", "Pre-Approval Status", "Pre-Approval Amount", "Pre-Approval Expiration", "Down Payment Available", "Earnest Money Available", "Lender Contact", "Target Move-In Date", "Lease End Date", "Relocating From", "Household Members", "Pets"];
const sellerFields = ["Property Address", "Property City", "Property State", "Property Postal Code", "Property MLS Number", "Property Price", "Property Beds", "Property Baths", "Property Area", "Property Lot", "Bedrooms", "Bathrooms", "Square Footage", "Lot Size", "Year Built", "Builder", "Key Features", "List Price", "Current Price", "Price Per Sqft", "Mortgage Balance", "Equity", "Net Proceeds", "Days On Market", "Showings", "Price Reductions", "Closing Date", "Commission Earned", "Purchase Price"];

async function fileFrom(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("Choose a Follow Up Boss CSV file.");
  if (file.size > 15_000_000) throw new Error("The CSV must be smaller than 15 MB for this importer.");
  const parsed = parseCsv(await file.text());
  if (!isFollowUpBoss(parsed.headers)) throw new Error("This does not look like a Follow Up Boss contact export.");
  return { ...parsed, file, form };
}

async function matchRow(db: D1Database, row: FubRow) {
  const id = row.ID?.trim(), phone = normalizePhone(row["Phone 1"]), email = normalizeEmail(row["Email 1"]);
  if (id) {
    const found = await db.prepare("SELECT id FROM contacts WHERE external_fub_id=? LIMIT 1").bind(id).first();
    if (found) return { type: "Exact duplicate", id: Number(found.id), reason: "Already imported" };
  }
  if (phone) {
    const found = await db.prepare("SELECT id FROM contacts WHERE replace(replace(replace(replace(phone,'+',''),'(',''),')',''),'-','') LIKE ? LIMIT 1").bind(`%${phone.slice(-10)}`).first();
    if (found) return { type: "Likely duplicate", id: Number(found.id), reason: "Matching phone" };
  }
  if (email) {
    const found = await db.prepare("SELECT id FROM contacts WHERE lower(trim(email))=? LIMIT 1").bind(email).first();
    if (found) return { type: "Likely duplicate", id: Number(found.id), reason: "Matching email" };
  }
  const { first, last } = contactName(row);
  const address = row["Address 1"] || formatContactAddress({addressStreet:row["Address 1 - Street"],addressCity:row["Address 1 - City"],addressState:row["Address 1 - State"],addressZip:row["Address 1 - Zip"]});
  if (first && last && address) {
    const found = await db.prepare("SELECT id FROM contacts WHERE lower(first_name)=lower(?) AND lower(last_name)=lower(?) AND lower(address)=lower(?) LIMIT 1").bind(first, last, address).first();
    if (found) return { type: "Possible duplicate", id: Number(found.id), reason: "Matching name and address" };
  }
  return { type: "No match", id: null, reason: "" };
}

async function analyze(db: D1Database, headers: string[], rows: FubRow[]) {
  let mobile = 0, emails = 0, texts = 0, calls = 0, notes = 0, transactions = 0, anniversaries = 0, relationships = 0, birthdays = 0, referrals = 0, malformed = 0;
  const duplicates: any[] = [], errors: any[] = [], contacts: any[] = [], warnings: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], name = contactName(row);
    if (!name.first && !name.last) { malformed++; errors.push({ row: i + 2, message: "Missing contact name" }); }
    if (normalizePhone(row["Phone 1"])) mobile++;
    if (normalizeEmail(row["Email 1"])) emails++;
    const sms = parseFubCommunications(row.Texts, "SMS"), callLog = parseFubCommunications(row.Calls, "Call");
    texts += sms.entries.length; calls += callLog.entries.length;
    notes += Number(!!row.Notes?.trim()) + Number(!!row.Background?.trim());
    if (row["Deal Close Date"] || row["Deal Price"] || row["Buy Close Date"] || row["Sell Close Date"] || row["Close Date"]) transactions++;
    if (row["Home Anniversary Date"]) anniversaries++;
    if (row["Relationship 1 First Name"] || row["Spouse Name"]) relationships++;
    if (row.Birthday) birthdays++;
    if (row["Referred By"]) referrals++;
    const match = await matchRow(db, row);
    if (callLog.unparsed.length || sms.unparsed.length) warnings.push({ row: i + 2, message: `${callLog.unparsed.length} call fragments and ${sms.unparsed.length} text fragments could not be parsed; original source is preserved for review.` });
    contacts.push({ row: i + 2, name: `${name.first} ${name.last}`.trim(), externalFubId: row.ID || null, match: match.type,
      phones: Array.from({length: 10}, (_, j) => row[`Phone ${j + 1}`]).filter(Boolean).length,
      emails: Array.from({length: 10}, (_, j) => row[`Email ${j + 1}`]).filter(Boolean).length,
      calls: callLog.entries.length, texts: sms.entries.length,
      notes: Number(!!row.Notes?.trim()) + Number(!!row.Background?.trim()),
      samples: [...sms.entries.slice(0, 3), ...callLog.entries.slice(0, 2)].sort((a,b) => a.occurredAt.localeCompare(b.occurredAt)).map((entry) => ({ kind: entry.kind, timestamp: entry.occurredAt, sender: entry.sender, recipient: entry.recipient, direction: entry.direction, body: entry.body.slice(0, 250), bodyMissing: !entry.body })),
      relationships: Number(!!(row["Relationship 1 First Name"] || row["Spouse Name"])), referrals: Number(!!row["Referred By"]),
      transactions: Number(!!(row["Deal Stage"] || row["Deal Close Date"] || row["Deal Price"])),
      birthday: row.Birthday || null, homeAnniversary: row["Home Anniversary Date"] || null });
    if (match.type !== "No match") duplicates.push({ row: i + 2, name: `${name.first} ${name.last}`.trim(), ...match });
  }
  return { total: rows.length, mobile, emails, texts, calls, notes, transactions, anniversaries, relationships, birthdays, referrals, malformed, duplicates, errors, warnings, contacts, unknownColumns: headers.filter((h) => !isSupportedColumn(h)) };
}

async function insertMethods(db: D1Database, row: FubRow, contactId: number, jobId: number) {
  for (let i = 1; i <= 10; i++) {
    const phone = row[`Phone ${i}`], email = row[`Email ${i}`];
    if (phone) await db.prepare("INSERT INTO contact_methods (contact_id,import_job_id,kind,value,normalized_value,label,source_system,is_primary) VALUES (?,?,?,?,?,?,?,?)").bind(contactId, jobId, "phone", phone, normalizePhone(phone) || null, row[`Phone ${i} - Type`] || null, SOURCE, i === 1 ? 1 : 0).run();
    if (email) await db.prepare("INSERT INTO contact_methods (contact_id,import_job_id,kind,value,normalized_value,label,source_system,is_primary) VALUES (?,?,?,?,?,?,?,?)").bind(contactId, jobId, "email", email, normalizeEmail(email), row[`Email ${i} - Type`] || null, SOURCE, i === 1 ? 1 : 0).run();
  }
  for (let i = 1; i <= 5; i++) {
    const parts = [row[`Address ${i}`], row[`Address ${i} - Street`], row[`Address ${i} - City`], row[`Address ${i} - State`], row[`Address ${i} - Zip`] || row[`Address ${i} - Postal Code`], row[`Address ${i} - Country`]].filter(Boolean);
    if (parts.length) await db.prepare("INSERT INTO contact_methods (contact_id,import_job_id,kind,value,label,source_system,is_primary) VALUES (?,?,?,?,?,?,?)").bind(contactId, jobId, "address", [...new Set(parts)].join(", "), row[`Address ${i} - Type`] || null, SOURCE, i === 1 ? 1 : 0).run();
  }
}

async function insertHistory(db: D1Database, row: FubRow, contactId: number, jobId: number) {
  for (const [field, type] of [["Calls", "Call"], ["Texts", "SMS"]] as const) {
    for (const entry of parseFubCommunications(row[field], type).entries) {
      const fingerprintSource = [SOURCE, row.ID || String(contactId), field, entry.occurredAt, entry.sender.toLowerCase(), entry.recipient.toLowerCase(), entry.body].join("\u0000");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintSource));
      const fingerprint = `fub:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
      await db.prepare("INSERT OR IGNORE INTO communications (contact_id,type,direction,occurred_at,message_transcript,duration_seconds,status,import_job_id,source_system,source_record_id,imported,original_imported_text,external_provider_id,author_name,participants) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(contactId, type, entry.direction, entry.occurredAt, entry.body || null, entry.durationSeconds, entry.result || "Imported", jobId, SOURCE, row.ID || null, 1, entry.original, fingerprint, entry.sender,
          JSON.stringify({ sender_name: entry.sender, recipient_name: entry.recipient, source_field: field, body_missing: !entry.body })).run();
    }
  }
  // Notes without a reliably recognized entry header remain intact; dates and authors are not invented.
  for (const field of ["Notes", "Background"]) if (row[field]?.trim())
    await db.prepare("INSERT INTO notes (contact_id,body,import_job_id,source_system,source_record_id) VALUES (?,?,?,?,?)").bind(contactId, `Imported from Follow Up Boss (${field}; structure unverified)\n\n${row[field]}`, jobId, SOURCE, row.ID || null).run();
}

async function insertStructured(db: D1Database, row: FubRow, contactId: number, jobId: number) {
  for (const field of [...buyerFields, ...sellerFields]) if (row[field])
    await db.prepare("INSERT INTO contact_intelligence (contact_id,import_job_id,category,field_name,value,status,source_system,source_record_id,source_field,confidence) VALUES (?,?,?,?,?,'Current',?,?,?,1)").bind(contactId, jobId, buyerFields.includes(field) ? "buyer" : "seller", field, row[field], SOURCE, row.ID || null, field).run();
  const relationships = [
    { type: row["Relationship 1 Type"] || "Related person", first: row["Relationship 1 First Name"], last: row["Relationship 1 Last Name"], field: "Relationship 1" },
    { type: "Spouse", first: (row["Spouse Name"] || "").split(/\s+/)[0], last: (row["Spouse Name"] || "").split(/\s+/).slice(1).join(" "), field: "Spouse Name" },
    { type: "Referred By", first: (row["Referred By"] || "").split(/\s+/)[0], last: (row["Referred By"] || "").split(/\s+/).slice(1).join(" "), field: "Referred By" },
  ];
  for (const rel of relationships) if (rel.first || rel.last)
    await db.prepare("INSERT INTO contact_relationships (contact_id,import_job_id,relationship_type,related_first_name,related_last_name,source_system,source_field) VALUES (?,?,?,?,?,?,?)").bind(contactId, jobId, rel.type, rel.first || null, rel.last || null, SOURCE, rel.field).run();
  for (const [field, type, label] of [["Birthday", "Birthday", "Birthday"], ["Spouse Birthday", "Spouse Birthday", "Spouse birthday"], ["Home Anniversary Date", "Home Purchase Anniversary", "Home purchase anniversary"], ["Deal Close Date", "Closed Transaction Anniversary", "Closing anniversary"]])
    if (row[field]) await db.prepare("INSERT INTO relationship_moments (contact_id,import_job_id,type,date_value,label,source_system) VALUES (?,?,?,?,?,?)").bind(contactId, jobId, type, row[field], label, SOURCE).run();
  const propertyAddress = [row["Property Address"], row["Property City"], row["Property State"], row["Property Postal Code"]].filter(Boolean).join(", ");
  if (propertyAddress) await db.prepare("INSERT INTO properties (contact_id,address,relationship,status,notes,import_job_id,source_system,external_record_id) VALUES (?,?,?, ?,?,?,?,?)").bind(contactId, propertyAddress, /seller/i.test(row.Stage || "") ? "Seller" : "Property", row["Deal Stage"] || row.Stage || null, JSON.stringify(Object.fromEntries(sellerFields.filter((f) => row[f]).map((f) => [f, row[f]]))), jobId, SOURCE, row.ID || null).run();
  if (row["Deal Stage"] || row["Deal Close Date"] || row["Deal Price"]) await db.prepare("INSERT INTO opportunities (contact_id,type,stage,estimated_price,expected_timeframe,property_address,notes,import_job_id,source_system,source_record_id) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(contactId, /seller/i.test(row.Stage || "") ? "Seller" : "Transaction", row["Deal Stage"] || "Historical", Number((row["Deal Price"] || "").replace(/[^0-9.]/g, "")) || null, row["Deal Close Date"] || null, propertyAddress || null, "Imported from Follow Up Boss", jobId, SOURCE, row.ID || null).run();
}

export async function GET(req?: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  const jobId = req ? new URL(req.url).searchParams.get("jobId") : null;
  if (jobId) {
    const rows = await env.DB.prepare("SELECT row_number,external_fub_id,contact_id,status,match_type,warning,error,raw_json FROM import_rows WHERE import_job_id=? ORDER BY row_number").bind(jobId).all();
    return NextResponse.json({ rows: rows.results });
  }
  const jobs = await env.DB.prepare("SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 25").all();
  return NextResponse.json({ jobs: jobs.results });
}

export async function POST(req: Request) {
  const auth = await authorizeCrmOwner(); if (auth.denied) return auth.denied;
  try {
    const mode = new URL(req.url).searchParams.get("mode") || "analyze";
    if (mode === "rollback") {
      const { jobId } = await req.json() as { jobId: number };
      const job = await env.DB.prepare("SELECT status FROM import_jobs WHERE id=?").bind(jobId).first<{ status: string }>();
      if (!job || job.status === "Rolled back") throw new Error("That import cannot be rolled back.");
      const ids = (await env.DB.prepare("SELECT id FROM contacts WHERE import_job_id=?").bind(jobId).all()).results.map((r: any) => Number(r.id));
      // Stop rather than erase any activity added after the import, including data from another job.
      for (const id of ids) {
        for (const table of ["activities", "tasks", "notes", "communications", "opportunities", "properties", "contact_methods", "contact_relationships", "contact_intelligence", "relationship_moments"]) {
          const scoped = ["notes", "communications", "opportunities", "properties", "contact_methods", "contact_relationships", "contact_intelligence", "relationship_moments"].includes(table);
          const count = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE contact_id=?${scoped ? " AND (import_job_id IS NULL OR import_job_id<>?)" : ""}`).bind(...(scoped ? [id, jobId] : [id])).first<{n:number}>();
          if (Number(count?.n)) throw new Error(`Contact ${id} has later CRM activity. Rollback stopped to protect it; inspect this job before removing records.`);
        }
      }
      for (const table of ["notes", "communications", "opportunities", "properties", "contact_methods", "contact_relationships", "contact_intelligence", "relationship_moments"])
        await env.DB.prepare(`DELETE FROM ${table} WHERE import_job_id=?`).bind(jobId).run();
      for (const id of ids) await env.DB.prepare("DELETE FROM contacts WHERE id=? AND import_job_id=?").bind(id, jobId).run();
      await env.DB.prepare("UPDATE import_rows SET contact_id=NULL WHERE import_job_id=?").bind(jobId).run();
      await env.DB.prepare("UPDATE import_jobs SET status='Rolled back',rolled_back_at=CURRENT_TIMESTAMP WHERE id=?").bind(jobId).run();
      return GET();
    }
    const { headers, records, file, form } = await fileFrom(req);
    const analysis = await analyze(env.DB, headers, records);
    if (mode === "analyze") return NextResponse.json({ analysis, detected: true, format: "Follow Up Boss", columns: headers.length });
    if (mode !== "import") throw new Error("Unknown import action.");
    if (records.length > 100) throw new Error("This importer accepts up to 100 contacts per file. Split larger exports into smaller files.");
    if (analysis.errors.length) throw new Error("Resolve malformed rows before importing.");
    const decisions = JSON.parse(String(form.get("decisions") || "{}")) as Record<string, "skip" | "merge" | "create">;
    if (Object.values(decisions).some((decision) => decision !== "skip")) throw new Error("Merging and creating duplicate contacts are disabled until their rollback and repeat-import behavior is verified.");
    const jobResult = await env.DB.prepare("INSERT INTO import_jobs (file_name,source_system,total_rows,status,warning_count,error_count,duplicate_records) VALUES (?,?,?,'Processing',?,?,?)").bind(file.name, SOURCE, records.length, analysis.unknownColumns.length, analysis.malformed, analysis.duplicates.length).run();
    const jobId = Number(jobResult.meta.last_row_id);
    let imported = 0, skipped = 0, errors = 0;
    for (let i = 0; i < records.length; i++) {
      const row = records[i], match = await matchRow(env.DB, row), names = contactName(row);
      if (!names.first && !names.last) { errors++; await env.DB.prepare("INSERT INTO import_rows (import_job_id,row_number,external_fub_id,status,error,raw_json) VALUES (?,?,?,'Error',?,?)").bind(jobId, i + 2, row.ID || null, "Missing contact name", JSON.stringify(row)).run(); continue; }
      const decision = decisions[String(i + 2)] || "skip";
      if (match.type !== "No match" && decision === "skip") { skipped++; await env.DB.prepare("INSERT INTO import_rows (import_job_id,row_number,external_fub_id,contact_id,status,match_type,warning,raw_json) VALUES (?,?,?,?, 'Skipped',?,?,?)").bind(jobId, i + 2, row.ID || null, match.id, match.type, `${match.reason}; skipped by review decision`, JSON.stringify(row)).run(); continue; }
      if (match.type !== "No match" && decision === "merge" && match.id) {
        await insertMethods(env.DB, row, match.id, jobId); await insertHistory(env.DB, row, match.id, jobId); await insertStructured(env.DB, row, match.id, jobId);
        await env.DB.prepare("INSERT INTO import_rows (import_job_id,row_number,external_fub_id,contact_id,status,match_type,warning,raw_json) VALUES (?,?,?,?, 'Merged',?,?,?)").bind(jobId, i + 2, row.ID || null, match.id, match.type, "Existing contact values preserved; incoming facts added with provenance", JSON.stringify(row)).run();
        imported++; continue;
      }
      const phone = normalizePhone(row["Phone 1"]), email = normalizeEmail(row["Email 1"]);
      const classification = fromFubStage(row.Stage || "");
      const primaryAddress = row["Address 1"] || formatContactAddress({addressStreet:row["Address 1 - Street"],addressCity:row["Address 1 - City"],addressState:row["Address 1 - State"],addressZip:row["Address 1 - Zip"] || row["Address 1 - Postal Code"]});
      const result = await env.DB.prepare("INSERT INTO contacts (first_name,last_name,phone,email,address,relationship,lead_source,intent,temperature,tags,external_fub_id,source_system,import_job_id,birthday,date_added,stage,timeframe,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP)").bind(names.first || "Unknown", names.last || "", phone || row["Phone 1"] || null, email || null, primaryAddress || null, classification.relationship, row["Lead Source"] || null, "None / Unknown", "Warm", row.Tags || null, row.ID || null, SOURCE, jobId, row.Birthday || null, row["Date Added"] || null, classification.stage, row.Timeframe || null, row["Date Added"] || null).run();
      const contactId = Number(result.meta.last_row_id);
      await insertMethods(env.DB, row, contactId, jobId); await insertHistory(env.DB, row, contactId, jobId); await insertStructured(env.DB, row, contactId, jobId);
      await env.DB.prepare("INSERT INTO import_rows (import_job_id,row_number,external_fub_id,contact_id,status,raw_json) VALUES (?,?,?,?, 'Imported',?)").bind(jobId, i + 2, row.ID || null, contactId, JSON.stringify(row)).run();
      imported++;
    }
    await env.DB.prepare("UPDATE import_jobs SET imported_records=?,skipped_records=?,error_count=?,status=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(imported, skipped, errors, errors ? "Completed with issues" : "Completed", jobId).run();
    return NextResponse.json({ jobId, imported, skipped, errors, analysis });
  } catch (error) {
    console.error("FUB import error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The import could not be processed." }, { status: 400 });
  }
}
