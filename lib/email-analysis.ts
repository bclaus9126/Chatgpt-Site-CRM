import { analyzeSmsConversation, type SmsMessage } from "./sms-analysis";

export type EmailMessage = SmsMessage & { subject?: string; threadId?: string };

// Keep the original message intact in storage. Quoted replies and automated tails
// must never be treated as newly authored statements.
export function authoredEmail(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex((line, i) =>
    /^\s*(?:On .+ wrote:|From:\s|Sent:\s|-----Original Message-----|Begin forwarded message:|>\s|_{8,}|-{8,}|unsubscribe\b|this email (?:and|is)|confidentiality notice\b)/i.test(line) ||
    (/^\s*--\s*$/.test(line) && i > 0));
  const fresh = (cut < 0 ? lines : lines.slice(0, cut)).join("\n");
  return fresh.replace(/\n\s*(?:Best|Regards|Sincerely|Thanks|Thank you),?\s*\n(?:Brad Claus|[A-Z][a-z]+ [A-Z][a-z]+)[\s\S]*$/i, "").trim();
}

export function analyzeEmailThread(messages: EmailMessage[], contactName: string, historical = false) {
  const authored = messages.map(m => ({ ...m, body: authoredEmail(m.body) })).filter(m => m.body);
  const suggestions = analyzeSmsConversation(authored, contactName, historical);
  // A short evidence excerpt belongs to the message that caused the proposal.
  return suggestions.map(s => ({ ...s, sourceExcerpt: s.sourceExcerpt.slice(0, 240) }));
}
