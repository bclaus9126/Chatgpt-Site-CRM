export const relationshipOptions = ["Lead", "Past Client", "Sphere", "Referral Partner", "Vendor", "Agent", "Lender", "Friend / Family"] as const;
export const intentOptions = ["None / Unknown", "Buyer", "Seller", "Buyer + Seller", "Investor", "Renter", "Landlord"] as const;
export const stageGroups = {
  Prospecting: ["Lead", "Nurture", "Opportunity", "Appointment Set", "Unresponsive", "Not Interested"],
  Listing: ["Listing Active", "Listing - Price Reduced"],
  Contract: ["Under Contract - Option Period", "Under Contract - Post-Option", "Pending"],
  "Post-close": ["Closed - Recent", "Closed"],
  "Archived / low priority": ["Trash"],
} as const;
export const stageOptions = Object.values(stageGroups).flat();

export function fromFubStage(stage: string) {
  const value = stage.trim();
  if (value.toLowerCase() === "past client") return { relationship: "Past Client", stage: null };
  if (value.toLowerCase() === "sphere") return { relationship: "Sphere", stage: null };
  return { relationship: "Lead", stage: stageOptions.find((option) => option.toLowerCase() === value.toLowerCase()) || null };
}
