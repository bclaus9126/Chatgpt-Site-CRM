// Conservative address classification: a bare address remains review-only.
export function addressSuggestion(text: string) {
  const match = text.match(/\b\d{1,6}\s+[\w .'-]+?\s+(?:Street|St|Drive|Dr|Road|Rd|Lane|Ln|Court|Ct|Avenue|Ave|Boulevard|Blvd|Way|Circle|Cir)\b(?:\s*,?\s*[\w ]+,?\s*[A-Z]{2}\s*\d{5})?/i);
  if (!match) return null;
  const address = match[0].trim();
  const contact = /\b(?:i moved to|we moved to|i live at|we live at|my mailing address is|my address is)\b/i.test(text);
  const seller = /\b(?:sell|selling|list|listing)\b/i.test(text) && /\b(?:house|home|property|place)\b/i.test(text);
  const transaction = /\b(?:writing an offer|under contract|closing on|contract on)\b/i.test(text);
  const buyer = /\b(?:considering|looking at|touring|buying|offer on)\b/i.test(text);
  const types = [contact,seller,transaction,buyer].filter(Boolean).length;
  const category = types !== 1 ? "ADDRESS REVIEW" : contact ? "CONTACT ADDRESS" : seller ? "SELLER PROPERTY" : transaction ? "TRANSACTION PROPERTY" : "BUYER PROPERTY";
  return { category, title: `${category === "ADDRESS REVIEW" ? "Classify address" : category}: ${address}`, fieldName: category.toLowerCase().replaceAll(" ","_"), fieldValue: address, sourceExcerpt: text.slice(0,240), needsReview: category === "ADDRESS REVIEW" };
}
