import { addressSuggestion } from "./address-intelligence";

export type MemoSuggestion = {
  category: string;
  title: string;
  detail?: string;
  dueDate?: string;
  dueTime?: string;
  fieldName?: string;
  fieldValue?: string;
  commitment?: boolean;
  sourceExcerpt: string;
  needsReview?: boolean;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const pad = (value: number) => String(value).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function weekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function centralDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return iso(get("year"), get("month"), get("day"));
}

export function resolveMemoDate(text: string, baseDate: string) {
  const lower = text.toLowerCase();
  let dueDate: string | undefined, needsReview = false;
  const flexible = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+or\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:maybe|sometime|perhaps)\b/i.test(lower);
  if (/\btoday\b/.test(lower)) dueDate = baseDate;
  else if (/\btomorrow\b/.test(lower)) dueDate = addDays(baseDate, 1);
  else {
    const weekdayMatch = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (weekdayMatch) {
      const target = WEEKDAYS.indexOf(weekdayMatch[1]);
      let delta = (target - weekday(baseDate) + 7) % 7;
      if (delta === 0) delta = 7;
      // "Next Wednesday" means the Wednesday in the following calendar week,
      // while bare "Wednesday" means the next upcoming Wednesday.
      if (new RegExp(`\\bnext\\s+${weekdayMatch[1]}\\b`).test(lower) && delta < 7) delta += 7;
      dueDate = addDays(baseDate, delta);
    } else {
      const monthMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/);
      if (monthMatch) {
        const [baseYear] = baseDate.split("-").map(Number);
        let year = Number(monthMatch[3]) || baseYear;
        const candidate = iso(year, MONTHS[monthMatch[1]], Number(monthMatch[2]));
        if (!monthMatch[3] && candidate < baseDate) year += 1;
        dueDate = iso(year, MONTHS[monthMatch[1]], Number(monthMatch[2]));
      }
    }
  }
  if (!dueDate && /\b(next week|later|soon|sometime|in a few days)\b/.test(lower)) needsReview = true;
  const timeMatch = lower.match(/\b(?:at\s+)?(1[0-2]|\d)(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  let dueTime: string | undefined;
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const pm = timeMatch[3].startsWith("p");
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    dueTime = `${pad(hour)}:${timeMatch[2] || "00"}`;
  }
  const daypart = lower.match(/\b(morning|afternoon|evening)\b/)?.[1];
  if (flexible) { dueDate = undefined; needsReview = true; }
  return { dueDate, dueTime, daypart, schedulingPrecision: flexible ? "flexible" : dueDate ? dueTime ? "exact_datetime" : daypart ? "daypart" : "date_only" : "unspecified", needsReview };
}

const cleanAction = (value: string) => value
  .replace(/\b(?:today|tomorrow|on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))?/ig, "")
  .replace(/\b(?:today|tomorrow)\b/ig, "")
  .replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "").trim();
const sentenceCase = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value;
const humanDate = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));

export function extractVoiceMemoIntelligence(transcript: string, baseDate = centralDate()): MemoSuggestion[] {
  const protectedTranscript = transcript.replace(/\ba\.m\./gi, "AMTOKEN").replace(/\bp\.m\./gi, "PMTOKEN");
  const sentences = protectedTranscript.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.replace(/AMTOKEN/g, "a.m.").replace(/PMTOKEN/g, "p.m.").trim()).filter(Boolean) || [];
  const contactName = transcript.match(/\b(?:met with|call|text|email)\s+([A-Z][a-z]+)/)?.[1];
  const output: MemoSuggestion[] = [];
  let lastTaskObject = "";
  for (const sourceExcerpt of sentences) {
    const text = sourceExcerpt.replace(/[.!?]+$/, "");
    const address = addressSuggestion(text);
    if (address) output.push(address);
    const lower = text.toLowerCase();
    if (/\bi met with\b/.test(lower)) {
      const note = text.replace(/^I met with/i, "Met with").replace(/\s+today\b/i, "").replace(/\s+about\s+/i, " regarding ");
      output.push({ category: "NOTE", title: `${note}.`, detail: sourceExcerpt, sourceExcerpt });
      continue;
    }
    const appointment = /\b(?:we\s+)?(?:scheduled|booked|set)\b.*\b(appointment|meeting|consultation|showing|call)\b/i.test(text);
    const contactAction = /\b(call|text|email|follow up with|contact)\b/i.test(text);
    const actionable = appointment || contactAction || /\b(?:create a task(?: for me)? to|I need(?: you)? to|I need to remember to|I told (?:her|him|them) I would|I promised to|I'll|I will)\b/i.test(text);
    if (actionable) {
      const date = resolveMemoDate(text, baseDate);
      let action = text.replace(/^.*?\b(?:create a task(?: for me)? to|I need(?: you)? to|I need to remember to|I told (?:her|him|them) I would|I promised to|I'll|I will)\s+/i, "");
      action = cleanAction(action).replace(/\bher\b/i, contactName || "contact").replace(/\bhim\b/i, contactName || "contact");
      if (/\bto review it\b/i.test(action) && lastTaskObject) action = action.replace(/\bit\b/i, lastTaskObject);
      const category = appointment ? "APPOINTMENT" : contactAction ? "FOLLOW-UP" : "TASK";
      if (category === "TASK") {
        action = action.replace(/^(prepare|send|create|complete|review|finish)\s+(?:a|an|the)\s+/i, "$1 ");
        lastTaskObject = action.replace(/^(prepare|send|create|complete|review|finish)\s+/i, "").replace(/^(?:a|an|the)\s+/i, "");
      }
      output.push({ category, title: sentenceCase(action), detail: sourceExcerpt, dueDate: date.dueDate, dueTime: date.dueTime, commitment: /\b(?:told .* I would|promised|I'll|I will)\b/i.test(text), sourceExcerpt, needsReview: date.needsReview });
      continue;
    }
    const price = text.match(/\$\s?([\d,]*\d)(?:\.\d+)?\s*(k|thousand)?/i);
    if (price) output.push({ category: "SELLER INTELLIGENCE", title: `Price expectation approximately ${price[0]}`, detail: sourceExcerpt, fieldName: "price_expectation", fieldValue: price[0], sourceExcerpt });
    const repairs = text.match(/repairs?[^.!?]*/i);
    if (repairs) {
      const date = resolveMemoDate(text, baseDate);
      output.push({ category: "PROPERTY TIMELINE", title: date.dueDate ? `Repairs expected complete ${humanDate(date.dueDate)}` : sentenceCase(repairs[0]), detail: sourceExcerpt, dueDate: date.dueDate, sourceExcerpt, needsReview: date.needsReview });
    }
    const concern = text.match(/(?:worried|concerned|nervous|afraid)[^.!?]*/i);
    if (concern) output.push({ category: "CONCERN", title: sentenceCase(concern[0]), detail: sourceExcerpt, sourceExcerpt });
  }
  if (!output.some((item) => item.category === "NOTE")) output.unshift({ category: "NOTE", title: "Add voice memo notes", detail: transcript, sourceExcerpt: transcript });
  const seen = new Set<string>();
  return output.filter((item) => {
    const key = `${item.category}:${item.title.toLowerCase().replace(/\W/g, "")}:${item.dueDate || ""}:${item.dueTime || ""}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 10);
}
