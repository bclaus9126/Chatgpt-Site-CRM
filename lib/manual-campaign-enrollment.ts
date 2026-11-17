import { enroll } from './campaign';
type Row = Record<string, any>;

export async function manuallyEnroll(db: D1Database, input: Row) {
  const contactId = Number(input.contactId), campaignId = Number(input.campaignId);
  if (![contactId, campaignId].every(id => Number.isSafeInteger(id) && id > 0)) throw Error('Choose a contact and campaign');
  const note = String(input.permissionNote || '').trim();
  if (!note || note.length > 2000) throw Error('Record how and when permission was received (up to 2,000 characters)');
  const contact = await db.prepare('SELECT * FROM contacts WHERE id=?').bind(contactId).first<Row>();
  const campaign = await db.prepare('SELECT * FROM campaign_templates WHERE id=?').bind(campaignId).first<Row>();
  if (!contact || !campaign?.active) throw Error('Choose an active campaign');
  if (contact.sms_opt_out || contact.email_unsubscribed) throw Error('Contact is opted out. Resolve their opt-out separately before enrolling.');
  if (await db.prepare("SELECT id FROM campaign_enrollments WHERE contact_id=? AND status IN ('active','paused') LIMIT 1").bind(contactId).first()) throw Error('Contact already has an active or paused campaign');
  if (await db.prepare("SELECT id FROM transactions WHERE contact_id=? AND status IN ('Active','Under Contract','Pending') LIMIT 1").bind(contactId).first()) throw Error('Contact has an active transaction; review their follow-up separately');
  const steps = (await db.prepare("SELECT channel FROM campaign_steps WHERE campaign_id=? AND active=1 AND execution_mode='automatic' AND channel IN ('SMS','email')").bind(campaignId).all<Row>()).results;
  const sms = input.smsConsent === true, email = input.emailConsent === true;
  if (steps.some(s => s.channel === 'SMS') && (!sms || !contact.phone)) throw Error('Confirm permission for automated texts and a phone number before enrolling');
  if (steps.some(s => s.channel === 'email') && (!email || !contact.email)) throw Error('Confirm permission for follow-up emails and an email address before enrolling');
  const subtype = String(input.leadSubtype || 'Facebook Property Lead');
  if (!['Facebook Property Lead','Facebook General Buyer Lead','Website Buyer Lead','Zillow Buyer Lead','Homes.com Buyer Lead','Unknown Internet Lead'].includes(subtype)) throw Error('Choose a valid lead subtype');
  await db.batch([
    db.prepare('UPDATE contacts SET sms_consent=CASE WHEN ?=1 THEN 1 ELSE sms_consent END,email_consent=CASE WHEN ?=1 THEN 1 ELSE email_consent END,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(Number(sms),Number(email),contactId),
    db.prepare("INSERT INTO activities(contact_id,type,title,detail,occurred_at) VALUES (?,'Consent Recorded','Follow-up permission recorded',?,CURRENT_TIMESTAMP)").bind(contactId,`Recorded by CRM owner. Automated SMS: ${sms ? 'confirmed' : 'not confirmed'}. Follow-up email: ${email ? 'confirmed' : 'not confirmed'}. Campaign: ${campaign.name}.\n${note}`),
  ]);
  return enroll(contactId,campaignId,subtype,false);
}
