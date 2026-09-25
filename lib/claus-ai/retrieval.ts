type Row = Record<string, any>;
import { dateMentions } from "./dates.mjs";
export type Evidence = { kind: string; id: number; contactId?: number; contact?: string; date?: string; excerpt: string; };
export type Retrieval = { records: Row[]; evidence: Evidence[]; tools: string[]; contactIds: number[]; totalMatches: number; draftSource?: Row };
const TZ = "America/Chicago";
const compact = (text: unknown, max = 420) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
const rows = async (db: D1Database, query: string, bindings: unknown[] = []) =>
  (await db.prepare(query).bind(...bindings).all<Row>()).results;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateAgo = (days: number) => { const date = new Date(`${today()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); };
const thisWeek = () => { const date = new Date(`${today()}T12:00:00Z`); const day = date.getUTCDay(); date.setUTCDate(date.getUTCDate() - ((day + 6) % 7)); const start = date.toISOString().slice(0, 10); date.setUTCDate(date.getUTCDate() + 7); return [start, date.toISOString().slice(0, 10)]; };
const contactFields = "id,first_name,last_name,relationship,intent,stage,lead_source,temperature,tags,birthday,spouse_name,address,price_range,target_locations,financing_type,desired_property,desired_move_date,property_address,selling_timeline,selling_reason,motivation,concerns,relationship_summary,contextual_notes,last_meaningful_contact,next_follow_up,recommended_next_action";
const nameOf = (row: Row) => [row.first_name, row.last_name].filter(Boolean).join(" ");
const topicTerms = (q: string) => {
  const stop = new Set(["what","which","about","from","this","that","said","have","does","their","there","derek","melissa","past","clients","client","contact","contacts","talking","talked","mentioned","mention","discussed","discuss","email","emailed","text","texts","message","messages","sent","selling","seller","buyers","buyer","months","month","last","when","where","with","they","them","those","into","over"]);
  const terms = q.match(/[a-z]{4,}/g)?.filter(x => !stop.has(x)).slice(0, 4) || [];
  if (/\b(sell|selling|seller)\b/.test(q)) terms.push("sell", "listing");
  if (/\b(downsiz)/.test(q)) terms.push("downsizing", "downsize", "smaller home");
  if (/\brepair/.test(q)) terms.push("repair", "fix");
  return [...new Set(terms)].slice(0, 6);
};
const ev = (kind: string, row: Row, text: string, date?: string): Evidence => ({ kind, id: Number(row.id), contactId: row.contact_id || row.id, contact: row.contact_name || nameOf(row), date, excerpt: compact(text, 380) });

export async function retrieve(db: D1Database, question: string, previousIds: number[] = [], scopedId?: number): Promise<Retrieval> {
  const q = question.toLowerCase(), evidence: Evidence[] = [], tools: string[] = [];
  const records: Row[] = [];
  let totalMatches = 0;
  const allNames = await rows(db, "SELECT id,first_name,last_name FROM contacts ORDER BY length(first_name)+length(last_name) DESC LIMIT 500");
  const named = allNames.find(c => q.includes(nameOf(c).toLowerCase()) || (c.first_name?.length >= 4 && new RegExp(`\\b${String(c.first_name).toLowerCase().replace(/[^a-z]/g, "")}\\b`).test(q)));
  const ids = scopedId ? [scopedId] : named ? [Number(named.id)] : /\b(those|them|these|he|she|that contact)\b/.test(q) ? previousIds.slice(0, 30) : [];
  const contactIds: number[] = [];
  const push = (items: Row[], kind: string, describe: (r: Row) => string, date?: (r: Row) => string) => {
    for (const r of items) {
      records.push({ kind, ...r });
      evidence.push(ev(kind, r, describe(r), date?.(r)));
      if (r.contact_id || kind === "contact") contactIds.push(Number(r.contact_id || r.id));
    }
  };
  const isDraft = /\b(draft|suggest|write|reply|respond)\b/.test(q) && /\b(text|sms|email|message|response|reply)\b/.test(q);
  const summary = /\b(summarize|summary|profile|what do (?:i|we) know)\b/.test(q);
  const timeline = /\b(what happened|timeline|last 90 days|recent history)\b/.test(q);
  if (ids.length && /\bthose\b/.test(q) && /\b(?:spoken|contacted|talked)\b/.test(q) && /this month/.test(q)) {
    tools.push("query_contacts", "search_communications");
    const month = `${today().slice(0, 7)}-01`;
    push(await rows(db, `SELECT ${contactFields} FROM contacts WHERE id IN (${ids.map(() => "?").join(",")}) AND EXISTS (SELECT 1 FROM communications m WHERE m.contact_id=contacts.id AND m.occurred_at>=?) ORDER BY last_name LIMIT 30`, [...ids, month]), "contact", r => `${nameOf(r)} · ${r.relationship} · ${r.intent} · last contact ${r.last_meaningful_contact || "not recorded"}`);
  } else if (ids.length && (summary || timeline || isDraft || /\bwhat (?:did|has)|\bwhen did|\bthey\b/.test(q))) {
    tools.push("get_contact");
    const cs = await rows(db, `SELECT ${contactFields} FROM contacts WHERE id IN (${ids.map(() => "?").join(",")}) LIMIT 10`, ids.slice(0, 10));
    push(cs, "contact", c => [nameOf(c), c.relationship, c.intent, c.stage, c.price_range, c.target_locations, c.selling_timeline, c.motivation].filter(Boolean).join(" · "));
    const id = ids[0];
    tools.push("get_contact_context");
    push(await rows(db, "SELECT id,contact_id,category,field_name,value,status,source_system,source_date FROM contact_intelligence WHERE contact_id=? AND status='Current' ORDER BY source_date DESC,id DESC LIMIT 12", [id]), "intelligence", r => `${r.field_name}: ${r.value} (${r.status}; ${r.source_system})`, r => r.source_date);
    push(await rows(db, "SELECT id,contact_id,title,type,status,due_date,due_time,notes FROM tasks WHERE contact_id=? AND status<>'Completed' ORDER BY due_date LIMIT 8", [id]), "task", r => `${r.title}; ${r.type}; ${r.due_date || "unscheduled"} ${r.due_time || ""}`);
    push(await rows(db, "SELECT id,contact_id,type,stage,estimated_price,property_address,expected_timeframe FROM opportunities WHERE contact_id=? ORDER BY updated_at DESC LIMIT 5", [id]), "opportunity", r => `${r.type} ${r.stage} ${r.estimated_price || ""} ${r.property_address || ""}`);
    push(await rows(db, "SELECT id,contact_id,address,relationship,status FROM properties WHERE contact_id=? ORDER BY created_at DESC LIMIT 5", [id]), "property", r => `${r.relationship || "Property"} · ${r.address} · ${r.status || "status not recorded"}`);
    push(await rows(db, "SELECT id,contact_id,related_first_name,related_last_name,relationship_type FROM contact_relationships WHERE contact_id=? LIMIT 10", [id]), "relationship", r => `${r.relationship_type}: ${r.related_first_name || ""} ${r.related_last_name || ""}`);
    push(await rows(db, "SELECT id,contact_id,type,date_value,label FROM relationship_moments WHERE contact_id=? ORDER BY date_value DESC LIMIT 6", [id]), "relationship_moment", r => `${r.label} · ${r.date_value}`, r => r.date_value);
    push(await rows(db, "SELECT s.id,m.contact_id,s.title,s.detail,s.due_date,s.status FROM communication_suggestions s JOIN communications m ON m.id=s.communication_id WHERE m.contact_id=? AND s.commitment=1 AND s.status NOT IN ('Rejected','Dismissed','Completed') ORDER BY s.due_date LIMIT 6", [id]), "commitment", r => `${r.title} · ${r.detail || ""} · ${r.due_date || "date not set"}`);
    const cutoff = timeline ? dateAgo(90) : dateAgo(365);
    const topic = summary || timeline || isDraft ? [] : topicTerms(q);
    const filter = topic.length ? ` AND (${topic.map(() => "lower(coalesce(message_transcript,'') || ' ' || coalesce(ai_summary,'')) LIKE ?").join(" OR ")})` : "";
    const comms = await rows(db, `SELECT id,contact_id,type,direction,occurred_at,subject,message_transcript,ai_summary FROM communications WHERE contact_id=? AND occurred_at>=?${filter} ORDER BY occurred_at DESC LIMIT 18`, [id, topic.length ? "1900-01-01" : cutoff, ...topic.map(t => `%${t}%`)]);
    push(comms, "communication", r => `${r.type} ${r.direction}: ${compact(r.ai_summary || r.message_transcript || r.subject)}`, r => r.occurred_at);
    push(await rows(db, "SELECT id,contact_id,body,created_at FROM notes WHERE contact_id=? ORDER BY created_at DESC LIMIT 6", [id]), "note", r => r.body, r => r.created_at);
  } else if (/\bappointment/.test(q)) {
    tools.push("query_appointments");
    const [start, end] = thisWeek();
    push(await rows(db, "SELECT t.id,t.contact_id,t.title,t.due_date,t.due_time,t.status,t.calendar_sync_status,c.first_name,c.last_name FROM tasks t LEFT JOIN contacts c ON c.id=t.contact_id WHERE t.type='Appointment' AND t.due_date>=? AND t.due_date<? AND t.status<>'Completed' ORDER BY t.due_date,t.due_time LIMIT 30", [start, end]), "appointment", r => `${r.title} · ${r.due_date} ${r.due_time || "time not set"} · ${r.status}`, r => r.due_date);
  } else if (/\b(?:promis\w*|commitments?)\b/.test(q)) {
    tools.push("query_commitments");
    push(await rows(db, "SELECT s.id,s.title,s.detail,s.due_date,s.status,m.contact_id,c.first_name,c.last_name FROM communication_suggestions s JOIN communications m ON m.id=s.communication_id LEFT JOIN contacts c ON c.id=m.contact_id WHERE s.commitment=1 AND s.status NOT IN ('Rejected','Dismissed','Completed') ORDER BY s.due_date LIMIT 30"), "commitment", r => `${r.title} · ${r.detail || ""} · ${r.due_date || "date not set"} · ${r.status}`);
  } else if (/\b(overdue|follow.up|tasks? due)/.test(q)) {
    tools.push("query_tasks");
    const compare = /today/.test(q) ? "<=" : "<";
    push(await rows(db, `SELECT t.id,t.contact_id,t.title,t.type,t.due_date,t.status,c.first_name,c.last_name FROM tasks t LEFT JOIN contacts c ON c.id=t.contact_id WHERE t.status<>'Completed' AND t.due_date${compare}? ORDER BY t.due_date LIMIT 30`, [today()]), "task", r => `${r.title} · ${r.due_date} · ${r.status}`, r => r.due_date);
    push(await rows(db, `SELECT ${contactFields} FROM contacts WHERE next_follow_up${compare}? ORDER BY next_follow_up LIMIT 30`, [today()]), "contact", r => `${nameOf(r)} · follow-up ${r.next_follow_up}: ${r.recommended_next_action || ""}`);
  } else if (/\b(?:referr\w*|referral\w*)\b/.test(q)) {
    tools.push("query_referrals");
    const yearFilter = /this year/.test(q) ? " AND r.source_date>=?" : "";
    push(await rows(db, `SELECT r.id,r.contact_id,r.relationship_type,r.related_first_name,r.related_last_name,r.source_date,c.first_name,c.last_name FROM contact_relationships r JOIN contacts c ON c.id=r.contact_id WHERE lower(r.relationship_type) LIKE '%referr%'${yearFilter} ORDER BY r.source_date DESC LIMIT 30`, yearFilter ? [`${today().slice(0, 4)}-01-01`] : []), "relationship", r => `${nameOf(r)} · ${r.relationship_type} · ${r.related_first_name || ""} ${r.related_last_name || ""}`, r => r.source_date);
  } else if (/\bclosed last year\b/.test(q)) {
    tools.push("query_transactions");
    const year = Number(today().slice(0, 4)) - 1;
    push(await rows(db, "SELECT o.id,o.contact_id,o.type,o.stage,o.estimated_price,o.property_address,o.expected_timeframe,c.first_name,c.last_name FROM opportunities o JOIN contacts c ON c.id=o.contact_id WHERE lower(o.stage) LIKE '%clos%' AND o.expected_timeframe>=? AND o.expected_timeframe<? ORDER BY o.expected_timeframe LIMIT 30", [`${year}-01-01`, `${year + 1}-01-01`]), "opportunity", r => `${r.type} · ${r.stage} · ${r.estimated_price || "price not recorded"} · ${r.expected_timeframe}`, r => r.expected_timeframe);
  } else if (/\b(contacts?|clients?|buyers?|sellers?|budget|price|schertz|cibolo|opportunit|6 months)/.test(q) && !/\b(say|said|mention|talk|discuss|email|text|sms)|sell before buy|moving after/.test(q)) {
    tools.push("query_contacts");
    const where: string[] = [], values: unknown[] = [];
    if (/past clients?/.test(q)) where.push("lower(relationship) IN ('past client','past clients')");
    if (/seller intent/.test(q)) where.push("lower(intent) LIKE '%seller%'");
    if (/active seller/.test(q)) where.push("(lower(intent) LIKE '%seller%' OR lower(stage) LIKE '%seller%')");
    if (/six months|6 months/.test(q)) { where.push("(last_meaningful_contact IS NULL OR last_meaningful_contact<?)"); values.push(dateAgo(183)); }
    if (/referred|referral/.test(q)) where.push("EXISTS (SELECT 1 FROM contact_relationships r WHERE r.contact_id=contacts.id AND lower(r.relationship_type) LIKE '%referr%')");
    const budget = q.match(/\b(?:budget|price).{0,35}\b(?:over|above|more than)\s*\$?([\d,]+)(k)?/);
    if (budget) {
      const minimum = Number(budget[1].replaceAll(",", "")) * (budget[2] ? 1000 : 1);
      where.push("EXISTS (SELECT 1 FROM contact_intelligence i WHERE i.contact_id=contacts.id AND i.status='Current' AND lower(i.field_name) IN ('price max','price ceiling','pre-approval amount') AND CAST(replace(replace(i.value,'$',''),',','') AS REAL)>?)");
      values.push(minimum);
    }
    if (/\bbuyers?\b/.test(q)) where.push("lower(intent) LIKE '%buyer%'");
    if (/schertz|cibolo/.test(q)) { const places = ["schertz", "cibolo"].filter(place => q.includes(place)); where.push(`(${places.map(() => "(lower(target_locations) LIKE ? OR lower(desired_property) LIKE ?)").join(" OR ")})`); for (const place of places) values.push(`%${place}%`, `%${place}%`); }
    if (ids.length) { where.push(`id IN (${ids.map(() => "?").join(",")})`); values.push(...ids); }
    const clause = where.length ? "WHERE " + where.join(" AND ") : "";
    totalMatches = Number((await db.prepare(`SELECT count(*) AS n FROM contacts ${clause}`).bind(...values).first<{ n: number }>())?.n || 0);
    push(await rows(db, `SELECT ${contactFields} FROM contacts ${clause} ORDER BY last_name,first_name LIMIT 30`, values), "contact", r => `${nameOf(r)} · ${r.relationship} · ${r.intent} · ${r.stage} · last contact ${r.last_meaningful_contact || "not recorded"} · ${r.price_range || ""}`);
  } else {
    tools.push("search_communications");
    const topic = topicTerms(q);
    const idFilter = ids.length ? ` AND m.contact_id IN (${ids.map(() => "?").join(",")})` : "";
    const cutoff = /six months|6 months/.test(q) ? dateAgo(183) : /90 days/.test(q) ? dateAgo(90) : "1900-01-01";
    const relationshipFilter = /past clients?/.test(q) ? " AND lower(c.relationship) IN ('past client','past clients')" : "";
    const termFilter = topic.length ? ` AND (${topic.map(() => "(lower(coalesce(m.message_transcript,'') || ' ' || coalesce(m.ai_summary,'') || ' ' || coalesce(m.subject,'')) LIKE ?)").join(" OR ")})` : "";
    const bindings = [cutoff, ...ids, ...topic.map(t => `%${t}%`)];
    push(await rows(db, `SELECT m.id,m.contact_id,m.type,m.direction,m.occurred_at,m.subject,m.message_transcript,m.ai_summary,c.first_name,c.last_name FROM communications m LEFT JOIN contacts c ON c.id=m.contact_id WHERE m.occurred_at>=?${idFilter}${relationshipFilter}${termFilter} ORDER BY m.occurred_at DESC LIMIT 30`, bindings), "communication", r => `${r.type} ${r.direction}: ${compact(r.ai_summary || r.message_transcript || r.subject)}`, r => r.occurred_at);
    if (topic.length || ids.length) push(await rows(db, `SELECT n.id,n.contact_id,n.body,n.created_at,c.first_name,c.last_name FROM notes n JOIN contacts c ON c.id=n.contact_id WHERE 1=1${ids.length ? ` AND n.contact_id IN (${ids.map(() => "?").join(",")})` : ""}${relationshipFilter}${topic.length ? ` AND (${topic.map(() => "lower(n.body) LIKE ?").join(" OR ")})` : ""} ORDER BY n.created_at DESC LIMIT 12`, [...ids, ...topic.map(t => `%${t}%`)]), "note", r => r.body, r => r.created_at);
  }
  let draftSource: Row | undefined;
  if (isDraft && ids.length) {
    tools.push("get_inbound_thread");
    draftSource = (await rows(db, "SELECT id,contact_id,type,direction,occurred_at,subject,message_transcript,participants FROM communications WHERE contact_id=? AND lower(direction)='inbound' AND lower(type) IN ('sms','email') ORDER BY occurred_at DESC LIMIT 1", [ids[0]]))[0];
    if (draftSource) {
      push(await rows(db, "SELECT id,contact_id,type,direction,occurred_at,subject,message_transcript FROM communications WHERE contact_id=? AND type=? AND occurred_at<=? ORDER BY occurred_at DESC LIMIT 15", [ids[0], draftSource.type, draftSource.occurred_at]), "communication", r => `${r.type} ${r.direction}: ${r.message_transcript || r.subject || ""}`, r => r.occurred_at);
    }
  }
  return { records: records.slice(0, 55).map(r => ({ ...r, relativeDates: r.kind === "communication" && r.message_transcript && r.occurred_at ? dateMentions(r.message_transcript, r.occurred_at) : [], message_transcript: compact(r.message_transcript), body: compact(r.body) })), evidence: evidence.slice(0, 55), tools, contactIds: [...new Set(contactIds)].slice(0, 30), totalMatches: totalMatches || evidence.length, draftSource };
}
