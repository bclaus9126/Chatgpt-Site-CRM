// Appointment times are local America/Chicago wall-clock values, inclusive.
export const APPOINTMENT_HOURS_ERROR = "Appointments must be between 7:00 AM and 8:00 PM Central. Choose a time within those hours.";
export function validAppointmentTime(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (typeof value === "string" && /^\d{2}:\d{2}$/.test(value) && value >= "07:00" && value <= "20:00" && Number(value.slice(3)) < 60);
}
export function resolveAppointmentTime(text: string): {time?: string; needsReview: boolean} {
  const explicit = text.match(/\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  const bare = explicit || text.match(/\b(?:at|around|about|do|for)\s+(1[0-2]|[1-9])(?::([0-5]\d))?\b/i) || text.match(/^\s*(1[0-2]|[1-9])(?::([0-5]\d))?(?=\s*(?:works|would|is|sounds|instead|better|[.!?]|$))/i);
  if (!bare) return {needsReview:false};
  const hour = Number(bare[1]) % 12, minute = bare[2] || "00";
  const format = (h:number) => `${String(h).padStart(2,"0")}:${minute}`;
  if (explicit) { const time=format(hour+(/^p/i.test(explicit[3])?12:0)); return validAppointmentTime(time)?{time,needsReview:false}:{needsReview:true}; }
  const candidates=[format(hour),format(hour+12)].filter(validAppointmentTime);
  return candidates.length===1?{time:candidates[0],needsReview:false}:{needsReview:true};
}
