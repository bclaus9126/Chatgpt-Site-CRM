export function formatContactAddress(value: Record<string, unknown>) {
  const street = String(value.addressStreet || "").trim();
  const city = String(value.addressCity || "").trim();
  const state = String(value.addressState || "").trim();
  const zip = String(value.addressZip || "").trim();
  const country = String(value.addressCountry || "").trim();
  return [street, [city, state].filter(Boolean).join(", ") + (zip ? `${city || state ? " " : ""}${zip}` : ""), country].filter(Boolean).join(", ");
}

// Existing records store a single display string. Keep it intact when the
// user opens and saves the editor without changing an address component.
export function splitContactAddress(address: string | null | undefined) {
  const parts = String(address || "").split(",").map(x => x.trim()).filter(Boolean);
  const street = parts.shift() || "";
  const locality = parts.length && /^[A-Z]{2}\b/.test(parts[0]) ? "" : parts.shift() || "";
  const region = parts.length && /^[A-Z]{2}\b/.test(parts[0]) ? parts.shift() || "" : "";
  const combined = [locality, region].filter(Boolean).join(" ");
  const match = combined.match(/^(.*?)(?:\s+([A-Z]{2}))?(?:\s+(\d{5}(?:-\d{4})?))?$/);
  return { addressStreet: street, addressCity: match?.[1] || locality, addressState: match?.[2] || "", addressZip: match?.[3] || "", addressCountry: parts.join(", ") };
}
