import { ORIGIN } from './graph';

export const IABS_URL = `${ORIGIN}/IABS-JLA.pdf`;
const NOTICE_URL = 'https://www.trec.texas.gov/forms/consumer-protection-notice';
const SITE_URL = 'https://www.theclausteam.com';

const escapeHtml = (value:string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));

export function withEmailFooter(message:string,unsubscribeUrl?:string) {
  const optOutText=unsubscribeUrl?`\n\nStop these follow-up emails: ${unsubscribeUrl}`:'';
  const optOutHtml=unsubscribeUrl?`<p><a href="${escapeHtml(unsubscribeUrl)}">Stop these follow-up emails</a></p>`:'';
  const text = `${message.trim()}${optOutText}\n\nIABS: ${IABS_URL}\nConsumer Protections Notice: ${NOTICE_URL}\n\nBrad Claus\nThe Claus Team\nMobile/Text: 210.759.9078\nwww.theclausteam.com`;
  const body=escapeHtml(message.trim()).replace(/\r?\n/g,'<br>');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5">${body}${optOutHtml}<br><a href="${IABS_URL}">IABS</a><br><a href="${NOTICE_URL}">Consumer Protections Notice</a><br><br>Brad Claus<br>The Claus Team<br>Mobile/Text: 210.759.9078<br><a href="${SITE_URL}">www.theclausteam.com</a></div>`;
  return {text,html};
}
