export type FubRow = Record<string, string>;

const coreHeaders = ["Date Added", "First Name", "Last Name", "Stage", "Lead Source"];

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = (rows.shift() || []).map((h) => h.trim().replace(/^\uFEFF/, ""));
  const records = rows.filter((r) => r.some(Boolean)).map((values) =>
    Object.fromEntries(headers.map((h, i) => [h, (values[i] || "").trim()])),
  );
  return { headers, records };
}

export function isFollowUpBoss(headers: string[]) {
  return coreHeaders.filter((h) => headers.includes(h)).length >= 4 &&
    (headers.includes("ID") || headers.includes("Phone 1") || headers.includes("Email 1"));
}

export function normalizePhone(value = "") {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+") && digits.length >= 8) return `+${digits}`;
  return "";
}

export const normalizeEmail = (value = "") => value.trim().toLowerCase();

export type FubCommunication = {
  kind: "SMS" | "Call";
  sender: string;
  recipient: string;
  occurredAt: string;
  body: string;
  direction: "inbound" | "outbound" | "unknown";
  durationSeconds: number | null;
  result: string | null;
  original: string;
};

// FUB exports show local wall time without an offset. Treat it as Central time,
// resolving the offset for the date itself so summer/winter messages sort correctly.
function centralTimestamp(date: string, hour: string, minute: string, meridiem: string) {
  const [month, day, year] = date.split("/").map(Number);
  const h = Number(hour) % 12 + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  const utcWall = Date.UTC(year, month - 1, day, h, Number(minute));
  if (new Date(utcWall).getUTCFullYear() !== year || new Date(utcWall).getUTCMonth() !== month - 1 || new Date(utcWall).getUTCDate() !== day) return null;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" });
  const offset = formatter.formatToParts(new Date(utcWall + 6 * 3600000)).find((part) => part.type === "timeZoneName")?.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!offset) return null;
  const minutes = (Number(offset[2]) * 60 + Number(offset[3] || 0)) * (offset[1] === "+" ? 1 : -1);
  return new Date(utcWall - minutes * 60000).toISOString();
}

const historyHeader = /^(.+?)\s+(texted|called)\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)(?:\s+\(([^)]*)\))?\s*$/i;

export function parseFubCommunications(value = "", kind: "SMS" | "Call", ownerName = "Brad Claus") {
  const entries: FubCommunication[] = [];
  const unparsed: string[] = [];
  let current: { match: RegExpMatchArray; lines: string[] } | null = null;
  let preamble: string[] = [];
  const finish = () => {
    if (!current) return;
    const { match, lines } = current;
    const timestamp = centralTimestamp(match[4], match[5], match[6], match[7]);
    const original = lines.join("\n");
    if (!timestamp) { unparsed.push(original); return; }
    const sender = match[1].trim(), recipient = match[3].trim();
    // Remove only the separator directly after the header and between entries.
    // Internal blank lines and line breaks in the message are retained.
    const bodyLines = lines.slice(1);
    if (bodyLines[0] === "") bodyLines.shift();
    while (bodyLines.at(-1) === "") bodyLines.pop();
    const detail = (match[8] || "").trim();
    entries.push({ kind, sender, recipient, occurredAt: timestamp, body: bodyLines.join("\n"),
      direction: sender.toLowerCase() === ownerName.toLowerCase() ? "outbound" : recipient.toLowerCase() === ownerName.toLowerCase() ? "inbound" : "unknown",
      durationSeconds: kind === "Call" && /^(\d+)\s*sec(?:onds?)?$/i.test(detail) ? Number(detail.match(/\d+/)?.[0]) : null,
      result: kind === "Call" && detail && !/^\d+\s*sec(?:onds?)?$/i.test(detail) ? detail : null,
      original });
  };
  for (const line of value.replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.match(historyHeader);
    if (match && (kind === "SMS" ? match[2].toLowerCase() === "texted" : match[2].toLowerCase() === "called")) {
      finish();
      if (preamble.some((part) => part.trim())) unparsed.push(preamble.join("\n"));
      preamble = [];
      current = { match, lines: [line] };
    } else if (current) current.lines.push(line);
    else preamble.push(line);
  }
  finish();
  if (preamble.some((part) => part.trim())) unparsed.push(preamble.join("\n"));
  return { entries, unparsed };
}

export function splitHistory(value = "") {
  if (!value.trim()) return [];
  const blocks = value.split(/\n(?=(?:\d{1,2}[\/-]\d{1,2}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]{2}\s+\d{1,2}))/).filter(Boolean);
  return blocks.length > 1 ? blocks : value.split(/\n{2,}|\s*\|\s*/).filter(Boolean);
}

export function historyTimestamp(value: string) {
  const match = value.match(/(?:\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i);
  if (!match) return null;
  const parsed = new Date(match[0]);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function historyDirection(value: string) {
  if (/\b(inbound|incoming|received|from contact)\b/i.test(value)) return "inbound";
  if (/\b(outbound|outgoing|sent|to contact)\b/i.test(value)) return "outbound";
  return "unknown";
}

export const supportedColumns = new Set([
  "Date Added", "Name", "First Name", "Last Name", "Stage", "Lead Source", "Assigned To",
  "Last Assigned", "Is Contacted", "Listing Price", "Tags", "Timeframe", "Message", "Description",
  "Notes", "Calls", "Texts", "Background", "Campaign Source", "Campaign Medium", "Campaign Term",
  "Campaign Content", "Campaign Name", "Deal Stage", "Deal Close Date", "Deal Price", "ID", "Birthday",
  "Home Anniversary Date", "Referred By", "Relationship 1 First Name", "Relationship 1 Last Name",
  "Relationship 1 Type", "Spouse Name", "Spouse Birthday", "Property Address", "Property City",
  "Property State", "Property Postal Code", "Property MLS Number", "Property Price", "Property Beds",
  "Property Baths", "Property Area", "Property Lot", "Price Min", "Price Max", "Price Ceiling",
  "Bedrooms Needed", "Bathrooms Needed", "Garage Size Needed", "Lot Size Preference", "Minimum Square Footage",
  "Specific Schools", "Must-Haves", "Nice-to-Haves", "Deal-Breakers", "Commute Anchor Address",
  "Max Commute Time", "Pre-Approval Status", "Pre-Approval Amount", "Pre-Approval Expiration",
  "Down Payment Available", "Earnest Money Available", "Lender Contact", "Target Move-In Date", "Lease End Date",
  "Relocating From", "Household Members", "Pets", "Bedrooms", "Bathrooms", "Square Footage", "Lot Size",
  "Year Built", "Builder", "Key Features", "List Price", "Current Price", "Price Per Sqft", "Mortgage Balance",
  "Equity", "Net Proceeds", "Days On Market", "Showings", "Price Reductions", "Closing Date", "Commission Earned",
  "Purchase Price", "Buy Close Date", "Sell Close Date", "Close Date",
]);

export function isSupportedColumn(header: string) {
  return supportedColumns.has(header) || /^(Phone|Email|Address) \d+(?: - .+)?$/.test(header) ||
    /^(Buyer|Seller|Sphere|Spouse|Relationship|Buy |Sell )/i.test(header);
}

export function contactName(row: FubRow) {
  let first = row["First Name"] || "", last = row["Last Name"] || "";
  if (!first && !last && row.Name) {
    const parts = row.Name.trim().split(/\s+/); first = parts.shift() || ""; last = parts.join(" ");
  }
  return { first, last };
}
