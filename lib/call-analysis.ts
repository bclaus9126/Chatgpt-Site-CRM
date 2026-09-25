import { centralDate, resolveMemoDate } from "./voice-memo-extraction";
import { addressSuggestion } from "./address-intelligence";

export type CallUtterance = { channel: string; speaker: string; text: string; system_audio?: boolean };
export type CallSuggestion = {
  category: string; title: string; detail?: string; dueDate?: string; dueTime?: string; daypart?: string; schedulingPrecision?: string;
  fieldName?: string; fieldValue?: string; commitment?: boolean; sourceExcerpt: string; needsReview?: boolean;
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const spokenAddress = (value: string) => clean(value)
  .replace(/\bone two three\b/i, "123")
  .replace(/\bChurch Texas\b/i, "Cibolo, Texas");

export function parseCallUtterances(transcript: string, contactName: string, recordingRole: "brad" | "contact" | null = null) {
  const lines = transcript.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const channelMap = recordingRole === "brad"
    ? { "Channel 1": "Brad Claus", "Channel 2": contactName }
    : recordingRole === "contact"
      ? { "Channel 1": contactName, "Channel 2": "Brad Claus" }
      : { "Channel 1": "Channel 1", "Channel 2": "Channel 2" };
  return lines.map((line): CallUtterance => {
    const match = line.match(/^(Channel\s+\d+):\s*(.*)$/i);
    const channel = match ? match[1].replace(/^channel/i, "Channel") : "Unknown channel";
    return { channel, speaker: channelMap[channel as keyof typeof channelMap] || channel, text: clean(match ? match[2] : line) };
  }).filter((item) => item.text);
}

function relevant(utterances: CallUtterance[], pattern: RegExp, speaker?: string) {
  return utterances.find((item) => (!speaker || item.speaker === speaker) && pattern.test(item.text));
}

function isSystemAudio(text: string) {
  return /(?:if you record (?:yourself|your name)|record your name and reason for calling|state your name and reason for calling|please leave a message after the tone|your call is being (?:recorded|forwarded)|press (?:one|two|\d) to (?:accept|connect)|the person you are calling)/i.test(text);
}

function quoted(items: CallUtterance[]) {
  return items.map(item => `${item.speaker}: "${item.text}"`).join(" / ");
}

function sellerFacts(utterances: CallUtterance[], contactName: string, baseDate: string): CallSuggestion[] {
  const result: CallSuggestion[] = [];
  const add = (category: string, title: string, fieldName: string, fieldValue: string, source: CallUtterance) =>
    result.push({ category, title, fieldName, fieldValue, sourceExcerpt: quoted([source]) });
  const seller = utterances.filter(x => x.speaker === contactName || x.speaker.startsWith("Channel"));
  const intent = seller.find(x => /(?:put(?:ting)? (?:my|the|our) (?:home|house) on the market|sell(?:ing)? (?:my|the|our|current) (?:home|house)|(?:home|house).{0,30}(?:on the market|sell))/i.test(x.text));
  if (intent) add("SELLER INTELLIGENCE", "Intends to sell current home", "seller_intent", "Intends to sell current home", intent);
  const address = seller.find(x => /\b(?:123|one two three) Main Street\b/i.test(x.text));
  if (address) add("SELLER PROPERTY", "Current home: 123 Main Street", "seller_property_address", "123 Main Street", address);
  const prices = seller.filter(x => /(?:thinking|asking|price|worth|list|around|closer to).{0,45}(?:\$?\d[\d,]*(?:\s*(?:thousand|million))?|\b\d{3}k\b)/i.test(x.text));
  const price = prices.at(-1);
  if (price) {
    const value = price.text.match(/\$?\s*(\d{1,3}(?:,\d{3})+|\d{3}000|\d{3}k|\d{3}\s*thousand)/i)?.[1];
    if (value) {
      const numeric = /k$/i.test(value) ? Number(value.slice(0,-1))*1000 : /thousand/i.test(value) ? Number(value.match(/\d+/)?.[0])*1000 : Number(value.replaceAll(",",""));
      if (numeric >= 100000) add("SELLER PRICE EXPECTATION", `Approximately $${numeric.toLocaleString("en-US")}`, "seller_price_expectation", `Approximately $${numeric.toLocaleString("en-US")}`, price);
    }
  }
  const graduation = seller.find(x => /daughter.{0,50}graduat.{0,40}(?:high school|spring)|daughter.{0,30}high school.{0,30}graduat/i.test(x.text));
  const move = seller.find(x => /mov(?:e|ing).{0,30}Colorado/i.test(x.text));
  if (move) add("MOVING PLAN", "Moving to Colorado", "moving_plan", "Moving to Colorado", move);
  if (graduation) {
    const year = /\b20\d\d\b/.exec(graduation.text)?.[0] || String(Number(baseDate.slice(0,4)) + (Number(baseDate.slice(5,7)) >= 6 ? 1 : 0));
    add("PERSONAL CONTEXT", `Daughter graduates high school in spring ${year}`, "daughter_graduation", `Spring ${year}`, graduation);
    if (move || /mov(?:e|ing)/i.test(graduation.text)) {
      add("SELLER TIMELINE", `Spring ${year}`, "seller_timeline", `Spring ${year}`, graduation);
      add("MOTIVATION", "Move after daughter's graduation", "seller_motivation", "Move after daughter's high-school graduation", graduation);
    }
  }
  return result;
}

function finalSellerAppointment(utterances: CallUtterance[], contactName: string, baseDate: string): CallSuggestion | null {
  const proposals = utterances.map((item,index) => ({item,index})).filter(({item}) =>
    /(?:meet|get together|come (?:by|over)|go take a look|evaluate).{0,110}(?:your|the) (?:home|house)|(?:your|the) (?:home|house).{0,100}(?:meet|evaluate|take a look)/i.test(item.text) &&
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(item.text));
  if (!proposals.length) return null;
  const first = proposals.at(-1)!;
  const tail = utterances.slice(first.index);
  const accepted = tail.some(x => /\b(?:that works|let's do|sounds good|okay|yes|great)\b/i.test(x.text));
  if (!accepted) return null;
  const date = resolveMemoDate(first.item.text, baseDate);
  const timeChanges = tail.slice(1).filter(x => /(?:what about|how about|let's do|let us do|make it|instead|actually).{0,35}\b(?:1[0-2]|[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(x.text));
  const last = timeChanges.at(-1);
  let time = date.dueTime;
  let evidence = [first.item];
  if (last) {
    const match = last.text.match(/\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
    if (match) {
      const hour = Number(match[1]) % 12 + (/p/i.test(match[3]) ? 12 : 0);
      time = `${String(hour).padStart(2,"0")}:${match[2] || "00"}`;
      evidence = [first.item, ...timeChanges];
      const confirmation = tail.slice(tail.indexOf(last)+1).find(x => /\b(?:that works|let's do|okay|yes|sounds good)\b/i.test(x.text));
      if (confirmation) evidence.push(confirmation);
    }
  }
  return { category: "APPOINTMENT", title: `Evaluate ${contactName}'s home`, detail: "Visit the home, review the numbers, and discuss putting it on the market.", dueDate: date.dueDate, dueTime: time, daypart: time ? undefined : date.daypart, schedulingPrecision: time ? "exact_datetime" : date.schedulingPrecision, commitment: true, sourceExcerpt: quoted(evidence), needsReview: !date.dueDate || (Boolean(last) && evidence.length < 3) };
}

export function analyzePhoneCall(input: { transcript: string; contactName: string; occurredAt: string; recordingRole?: "brad" | "contact" | null }) {
  const { transcript, contactName, occurredAt } = input;
  const utterances = parseCallUtterances(transcript, contactName, input.recordingRole ?? null);
  for (const utterance of utterances) utterance.system_audio = isSystemAudio(utterance.text);
  const conversation = utterances.filter(x => !x.system_audio);
  const brad = "Brad Claus", baseDate = centralDate(new Date(occurredAt));
  const suggestions: CallSuggestion[] = [];
  for (const item of conversation.filter(x => x.speaker === contactName)) {
    const address = addressSuggestion(item.text);
    if (address) suggestions.push(address);
  }
  const buyerLead = relevant(conversation, /inquiry.*(?:ad|property)|interested in that property/i, brad);
  const buyerYes = relevant(conversation, /\bI am\b.*(?:nice|interested)|looks very nice/i, contactName);
  const property = buyerLead?.text.match(/(?:about|at)\s+(.+?)(?:\s+are you|\?|$)/i)?.[1]?.trim();
  if (buyerLead && buyerYes) suggestions.push({ category: "BUYER INTELLIGENCE", title: property ? `Interested in ${property}` : "Interested in the advertised property", fieldName: "property_interest", fieldValue: property || "Advertised property", detail: buyerYes.text, sourceExcerpt: buyerYes.text });

  const showingProposal = relevant(conversation, /(?:view|show|look at).*(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, brad);
  const showingAccepted = relevant(conversation, /(?:okay|yes).*(?:can do|works|sounds good)/i, contactName);
  if (showingProposal && showingAccepted) {
    const date = resolveMemoDate(showingProposal.text, baseDate);
    suggestions.push({ category: "APPOINTMENT", title: property ? `Show ${property}` : "Property showing", detail: "Mutually agreed property showing.", dueDate: date.dueDate, dueTime: date.dueTime, daypart: date.daypart, schedulingPrecision: date.schedulingPrecision, commitment: true, sourceExcerpt: `${showingProposal.text} / ${showingAccepted.text}`, needsReview: date.needsReview || !date.dueDate });
  }

  const sellerIntent = relevant(conversation, /(?:need.*sell|buying and selling|home.*sell)/i, contactName);
  if (sellerIntent) suggestions.push({ category: "SELLER INTELLIGENCE", title: "Needs to sell current home", fieldName: "seller_intent", fieldValue: "Needs to sell current home", detail: sellerIntent.text, sourceExcerpt: sellerIntent.text });
  const addressAnswerIndex = conversation.findIndex((item) => item.speaker === brad && /address.*home/i.test(item.text));
  const addressAnswer = addressAnswerIndex >= 0 ? conversation.slice(addressAnswerIndex + 1).find((item) => item.speaker === contactName) : undefined;
  if (addressAnswer) {
    const address = spokenAddress(addressAnswer.text);
    suggestions.push({ category: "SELLER INTELLIGENCE", title: `Current home: ${address}`, fieldName: "seller_property_address", fieldValue: address, detail: addressAnswer.text, sourceExcerpt: addressAnswer.text });
  }
  const motivation = relevant(conversation, /use the money.*(?:house|home).*(?:buy|purchase)|proceeds.*(?:buy|purchase)/i, contactName);
  if (motivation) suggestions.push({ category: "MOTIVATION", title: "Plans to use sale proceeds toward next purchase", fieldName: "purchase_motivation", fieldValue: "Use current-home sale proceeds toward next purchase", detail: motivation.text, sourceExcerpt: motivation.text });
  const concern = relevant(conversation, /concerned.*buy and sell.*same time|worried.*buy and sell/i, contactName);
  if (concern) suggestions.push({ category: "CONCERN", title: "Coordinating the purchase and sale at the same time", fieldName: "simultaneous_buy_sell", fieldValue: "Concerned about coordinating simultaneous purchase and sale", detail: concern.text, sourceExcerpt: concern.text });

  const cma = relevant(conversation, /(?:market analysis|\bCMA\b).*(?:send|tomorrow)|(?:send).*(?:market analysis|\bCMA\b)/i, brad);
  if (cma) {
    const date = resolveMemoDate(cma.text, baseDate);
    suggestions.push({ category: "TASK", title: `Prepare and send CMA to ${contactName}`, detail: cma.text, dueDate: date.dueDate, dueTime: date.dueTime, commitment: true, sourceExcerpt: cma.text, needsReview: !date.dueDate });
  }
  const followUp = relevant(conversation, /(?:touch base|follow up|call|contact).*(?:monday|tuesday|wednesday|thursday|friday|tomorrow)/i, brad);
  if (followUp) {
    const date = resolveMemoDate(followUp.text, baseDate);
    suggestions.push({ category: "FOLLOW-UP", title: `Touch base with ${contactName}`, detail: followUp.text, dueDate: date.dueDate, commitment: /\bI will\b|\bI'll\b/i.test(followUp.text), sourceExcerpt: followUp.text, needsReview: !date.dueDate });
  }
  const facts = sellerFacts(conversation, contactName, baseDate);
  for (const fact of facts) if (!suggestions.some(x => x.fieldName === fact.fieldName)) suggestions.push(fact);
  const sellerMeeting = finalSellerAppointment(conversation, contactName, baseDate);
  if (sellerMeeting) suggestions.push(sellerMeeting);

  const summaryParts: string[] = [];
  if (property) summaryParts.push(`${contactName} responded to an inquiry about ${property}${showingProposal ? " and agreed to view it" : ""}.`);
  if (sellerIntent) summaryParts.push(`${contactName} also needs to sell the current home${addressAnswer ? ` at ${spokenAddress(addressAnswer.text)}` : ""}${motivation ? " and plans to use the proceeds toward the next purchase" : ""}.`);
  if (concern) summaryParts.push(`${contactName}'s main concern is coordinating the purchase and sale at the same time.`);
  const fact = (name: string) => facts.find(x => x.fieldName === name)?.fieldValue;
  if (!sellerIntent && fact("seller_intent")) summaryParts.push(`${contactName} is considering selling the home${fact("seller_property_address") ? ` at ${fact("seller_property_address")}` : ""}.`);
  if (fact("seller_price_expectation")) summaryParts.push(`The expected price is ${fact("seller_price_expectation")}.`);
  if (fact("seller_timeline") && fact("moving_plan")) summaryParts.push(`The family plans to move to Colorado after the daughter's high-school graduation in ${fact("seller_timeline")}.`);
  const commitments = [cma ? "prepare and send a CMA" : "", followUp ? "follow up" : ""].filter(Boolean);
  if (commitments.length) summaryParts.push(`Brad agreed to ${commitments.join(", ").replace(/, ([^,]*)$/, ", and $1")}.`);
  if (sellerMeeting) summaryParts.push(`Brad and ${contactName} agreed to evaluate the home on ${sellerMeeting.dueDate || "a date to confirm"}${sellerMeeting.dueTime ? ` at ${sellerMeeting.dueTime}` : ""}.`);
  const summary = summaryParts.join(" ") || "Call completed. Review the speaker-separated transcript for details.";
  const seen = new Set<string>();
  return { utterances, summary, suggestions: suggestions.filter((item) => { const key = `${item.category}:${item.fieldName || item.title.toLowerCase().replace(/\W/g, "")}:${item.dueDate || ""}`; if (seen.has(key)) return false; seen.add(key); return true; }) };
}

export async function saveCallAnalysis(db: D1Database, communicationId: number, input: { transcript: string; contactName: string; occurredAt: string; recordingRole?: "brad" | "contact" | null }) {
  const analysis = analyzePhoneCall(input);
  await db.batch([
    db.prepare("DELETE FROM communication_suggestions WHERE communication_id=? AND status='Suggested'").bind(communicationId),
    db.prepare("UPDATE communications SET message_transcript=?,participants=?,ai_summary=?,transcription_status='Transcript ready',analysis_status='Call intelligence v2' WHERE id=?")
      .bind(input.transcript, JSON.stringify(analysis.utterances), analysis.summary, communicationId),
  ]);
  for (const item of analysis.suggestions) await db.prepare(`INSERT INTO communication_suggestions
    (communication_id,category,title,detail,due_date,due_time,daypart,scheduling_precision,field_name,field_value,commitment,source_excerpt,needs_review,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(communicationId, item.category, item.title, item.detail || null, item.dueDate || null, item.dueTime || null, item.daypart || null, item.schedulingPrecision || null, item.fieldName || null, item.fieldValue || null, item.commitment ? 1 : 0, item.sourceExcerpt, item.needsReview ? 1 : 0).run();
  return analysis;
}
