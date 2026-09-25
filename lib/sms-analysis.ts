import { centralDate, resolveMemoDate } from "./voice-memo-extraction";
import type { CallSuggestion } from "./call-analysis";
import { addressSuggestion } from "./address-intelligence";

export type SmsMessage = { id: number; sender: string; recipient: string; body: string; occurredAt: string };
export type SmsSuggestion = CallSuggestion & { sourceMessageId: number };
const evidence = (message: SmsMessage) => message.body.trim().slice(0, 240);
const price = (raw: string) => Number(raw.replace(/[^\d]/g, "")) * (/k/i.test(raw) ? 1000 : 1);

export function analyzeSmsConversation(messages: SmsMessage[], contactName: string, historical = false) {
  const ordered = [...messages].filter((m) => m.body.trim()).sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.id - b.id).slice(-60);
  const facts = new Map<string, SmsSuggestion>();
  const actions: SmsSuggestion[] = [];
  const addFact = (key: string, suggestion: SmsSuggestion) => facts.set(key, suggestion);
  const current = ordered.at(-1);
  const recent = (m: SmsMessage) => !historical || (current && Date.parse(current.occurredAt) - Date.parse(m.occurredAt) < 7 * 86400000);
  let appointment: { proposal: SmsMessage; date: ReturnType<typeof resolveMemoDate>; time: string | undefined; confirmation?: SmsMessage } | null = null;
  for (const message of ordered) {
    const text = message.body.trim(), lower = text.toLowerCase(), fromBrad = message.sender.toLowerCase() === "brad claus";
    const expandedDateText = text.replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/gi, (month) => ({ jan:"January",feb:"February",mar:"March",apr:"April",jun:"June",jul:"July",aug:"August",sep:"September",sept:"September",oct:"October",nov:"November",dec:"December" })[month.toLowerCase()] || month);
    const date = resolveMemoDate(expandedDateText, centralDate(new Date(message.occurredAt)));
    const take = (category: string, title: string, fieldName: string, value: string) => addFact(fieldName, { category, title, fieldName, fieldValue: value, sourceExcerpt: evidence(message), sourceMessageId: message.id });
    if (!fromBrad) { const address = addressSuggestion(text); if (address) addFact(address.fieldName, {...address, sourceMessageId:message.id}); }
    const amount = text.match(/(?:\$\s*)?(\d{1,3}(?:,\d{3})+|\d{2,3}k)\b/i);
    if (amount) {
      const value = price(amount[0]);
      if (/\b(?:under|below|maximum|max|ceiling|budget)\b/i.test(text) && value >= 100000) take("BUYER INTELLIGENCE", `Price ceiling $${value.toLocaleString()}`, "buyer_price_ceiling", String(value));
      else if (/\b(?:actually|can go to|up to)\b/i.test(text) && facts.has("buyer_price_ceiling") && value >= 100000) take("BUYER INTELLIGENCE", `Price ceiling $${value.toLocaleString()}`, "buyer_price_ceiling", String(value));
      if (/\b(?:list|listing|ask|asking|sell|price expectation)\b/i.test(text) && value >= 100000) take("SELLER INTELLIGENCE", `Price expectation approximately $${value.toLocaleString()}`, "seller_price_expectation", String(value));
      if (/\b(?:owe|mortgage balance)\b/i.test(text) && value >= 100000) take("SELLER INTELLIGENCE", `Mortgage balance approximately $${value.toLocaleString()}`, "mortgage_balance", String(value));
    }
    const beds = text.match(/(?:at least|need|want)\s+(\d+)\s*(?:bedrooms?|beds?)\b/i);
    if (beds) take("BUYER INTELLIGENCE", `Bedrooms needed ${beds[1]}+`, "bedrooms_needed", `${beds[1]}+`);
    if (/\b(?:schertz|cibolo)\b/i.test(text) && /\b(?:want|only|looking|search|area|location|in)\b/i.test(text)) {
      const areas = ["Schertz", "Cibolo"].filter((place) => new RegExp(`\\b${place}\\b`, "i").test(text));
      take("BUYER INTELLIGENCE", `Target locations ${areas.join(", ")}`, "target_locations", areas.join(", "));
    }
    if (/\b(?:need|must have|want)\s+(?:a\s+)?pool\b/i.test(text)) take("BUYER INTELLIGENCE", "Must-have: Pool", "must_have_pool", "Pool");
    if (/\b(?:worried|concerned)\b.*\bsell(?:ing)?\b.*\b(?:buy|live|nowhere)\b/i.test(text)) take("CONCERN", "Coordinating sale before purchase", "sell_before_buy_concern", "Concerned about selling before buying");
    if (/\b(?:have to|need to|must)\s+sell\b.*\b(?:first|before)\b/i.test(text)) take("BUYER INTELLIGENCE", "Must sell current home before buying", "sell_before_buy_dependency", "Must sell before purchasing");
    if (/\b(?:wait|after)\b.*\bdaughter\b.*\bgraduat/i.test(text)) take("SELLER INTELLIGENCE", "Wait until daughter graduates", "seller_timeline", text.slice(0,240));
    if (/\bdaughter\b.*\bgraduat/i.test(text)) take("PERSONAL CONTEXT", "Daughter's graduation", "daughter_graduation", text.slice(0, 240));
    if (/\bdaughter\b.*\bgraduat/i.test(text) && date.dueDate) addFact("daughter_graduation_moment", { category: "RELATIONSHIP MOMENT", title: "Daughter's graduation", dueDate: date.dueDate, sourceExcerpt: evidence(message), sourceMessageId: message.id });
    if (/\bmom\b.*\bsurgery\b/i.test(text)) take("PERSONAL CONTEXT", "Mother's surgery", "family_surgery", text.slice(0, 240));
    if (/\bmoving\b.*\bbecause\b/i.test(text)) take("MOTIVATION", "Reason for moving", "moving_motivation", text.slice(0, 240));
    if (/\brepairs?\b.*\b(?:done|ready|finished|complete)\b/i.test(text) && date.dueDate) take("PROPERTY TIMELINE", `Repairs expected complete ${date.dueDate}`, "repairs_complete", date.dueDate);
    if (/\b(?:house|home|property)\b.*\bready\b/i.test(text) && date.dueDate) take("PROPERTY TIMELINE", `Property expected ready ${date.dueDate}`, "property_ready_date", date.dueDate);
    if (/\blease\b.*\bend/i.test(text)) take("BUYER INTELLIGENCE", "Lease end affects timeline", "lease_timeline", text.slice(0, 240));
    if (/\b(?:meet|appointment|showing|get together)\b/i.test(text) && date.dueDate) {
      appointment = { proposal: message, date, time: date.dueTime };
    } else if (appointment && /\b(?:better|instead|works|let's do|okay)\b/i.test(text)) {
      if (date.dueDate && /\b(?:better|instead|let's do|works)\b/i.test(text)) appointment.date = date;
      const explicit = text.match(/\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)?\b/i);
      if (explicit && /\b(?:better|instead|works|let's do|okay)\b/i.test(text)) {
        const hour = Number(explicit[1]) % 12 + (/p/i.test(explicit[3] || "") ? 12 : 0);
        appointment.time = `${String(hour).padStart(2,"0")}:${explicit[2] || "00"}`;
        appointment.confirmation = message;
      } else if (/\b(?:perfect|works|agreed|confirmed)\b/i.test(text)) appointment.confirmation = message;
    }
    if (fromBrad && recent(message) && /\b(?:i'll|i will|i need to|i promised to)\s+(?:send|prepare|get|call|text|follow up|check)\b/i.test(text)) {
      const isFollowUp = /\b(?:call|text|follow up)\b/i.test(text);
      const action = /\bCMA\b/i.test(text) ? "Send updated CMA" : /\blender\b/i.test(text) ? "Check with lender and respond" : /\brepair quotes?\b/i.test(text) ? "Get repair quotes" : isFollowUp ? `Follow up with ${contactName}` : text.replace(/^.*?\b(?:i'll|i will|i need to|i promised to)\s+/i, "").replace(/[.!]+$/, "");
      actions.push({ category: isFollowUp ? "FOLLOW-UP" : "TASK", title: action, dueDate: date.dueDate, dueTime: date.dueTime, daypart: date.daypart, commitment: true, sourceExcerpt: evidence(message), needsReview: date.needsReview || (isFollowUp && !date.dueDate), sourceMessageId: message.id });
    }
    if (!fromBrad && recent(message) && /\bcheck back\b/i.test(text)) actions.push({ category: "FOLLOW-UP", title: `Follow up with ${contactName}`, detail: text, dueDate: date.dueDate, sourceExcerpt: evidence(message), needsReview: !date.dueDate || date.needsReview, sourceMessageId: message.id });
  }
  if (appointment?.confirmation && recent(appointment.proposal)) actions.push({ category: "APPOINTMENT", title: `Meet ${contactName}`, dueDate: appointment.date.dueDate, dueTime: appointment.time, daypart: appointment.date.daypart, schedulingPrecision: appointment.time ? "exact_datetime" : appointment.date.schedulingPrecision, commitment: true, sourceExcerpt: `${evidence(appointment.proposal)} / ${evidence(appointment.confirmation)}`, needsReview: appointment.date.needsReview, sourceMessageId: appointment.confirmation.id });
  return [...facts.values(), ...actions].slice(0, 20);
}
