const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function chicagoDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map(p => [p.type, p.value]));
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
}
export function resolveRelativeDate(phrase, timestamp) {
  const date = chicagoDate(timestamp);
  if (!date) return null;
  const p = phrase.trim().toLowerCase(), day = date.getUTCDay();
  if (p === "tomorrow") date.setUTCDate(date.getUTCDate() + 1);
  else if (p === "next month") date.setUTCMonth(date.getUTCMonth() + 1, 1);
  else if (p === "after thanksgiving") {
    let year = date.getUTCFullYear();
    const holiday = y => { const nov = new Date(Date.UTC(y, 10, 1, 12)); return new Date(Date.UTC(y, 10, 1 + ((4 - nov.getUTCDay() + 7) % 7) + 21, 12)); };
    if (date > holiday(year)) year++;
    date.setTime(holiday(year).getTime()); date.setUTCDate(date.getUTCDate() + 1);
  }
  else {
    const weekday = p.match(/^(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
    if (!weekday) return null;
    const target = weekdays.indexOf(weekday[2]);
    const offset = weekday[1] ? (7 - day + target) : ((target - day + 7) % 7 || 7);
    date.setUTCDate(date.getUTCDate() + offset);
  }
  return date.toISOString().slice(0, 10);
}
export function dateMentions(text, timestamp) {
  const matches = [...text.matchAll(/\b(after thanksgiving|tomorrow|next month|next (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi)].slice(0, 5);
  return matches.map(m => ({ phrase: m[0], anchorTimestamp: timestamp, calendarDate: resolveRelativeDate(m[0], timestamp), precision: /^after/i.test(m[0]) ? "after date" : /month/i.test(m[0]) ? "month" : "date", hasTime: /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(text) })).filter(m => m.calendarDate);
}
