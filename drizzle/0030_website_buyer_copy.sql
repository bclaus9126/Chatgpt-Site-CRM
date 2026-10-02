-- Website Buyer Lead approved copy. Base templates remain empty for other subtypes.
-- Run once; existing campaign and cadence were seeded before this migration.
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 1 call','call','Website Buyer Lead','Call {{first_name}} – new website buyer lead','New buyer inquiry from The Claus Team website. Introduce yourself and determine where they are in the buying process.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 1 call' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=1 AND s.channel='call' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='09:00',relative_delay=0,ai_personalization_enabled=0 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=1 AND channel='call';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 1 SMS','SMS','Website Buyer Lead',NULL,'Hi {{first_name}}, this is Brad Claus. I saw you reached out through my website about buying a home and wanted to introduce myself. Are you actively looking right now, or are you still in the early stages?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 1 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=1 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=5,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=1 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 1 email','email','Website Buyer Lead','Your home search','Hi {{first_name}},

I wanted to introduce myself after you reached out through my website.

I’m Brad Claus with The Claus Team. If you tell me a little about what you’re looking for, I can help narrow things down instead of flooding you with homes that don’t fit.

The easiest place to start is: what area are you considering, and are you looking to move soon or mostly planning ahead?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 1 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=1 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:05',relative_delay=20,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=1 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 2 SMS','SMS','Website Buyer Lead',NULL,'Hi {{first_name}}, one quick question that helps me point you in the right direction: what area or part of town are you most interested in?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 2 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=2 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=2 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 2 email','email','Website Buyer Lead','What area are you considering?','Hi {{first_name}},

One of the biggest things that helps me narrow down a home search is location.

Are there particular areas, neighborhoods, school districts, or commute requirements that matter most to you?

Even a general answer is enough for me to start helping.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 2 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=2 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=2 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 3 SMS','SMS','Website Buyer Lead',NULL,'Do you already have a price range in mind, {{first_name}}, or are you still figuring out what monthly payment feels comfortable?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 3 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=3 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=3 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 3 email','email','Website Buyer Lead','Price range vs. monthly payment','Hi {{first_name}},

Some buyers start with a purchase price. Others know what monthly payment they want to stay around.

Either works.

If you have a rough number in mind, send it over and I can help you figure out what kind of homes that puts you in.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 3 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=3 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=3 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 4 SMS','SMS','Website Buyer Lead',NULL,'Are you already preapproved for financing, or would it help if I connected you with someone who can walk you through the numbers?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 4 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=4 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=4 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 4 email','email','Website Buyer Lead','Financing question','Hi {{first_name}},

If you haven’t talked with a lender yet, that’s completely normal.

Getting the financing side figured out early can help answer questions about price range, monthly payment, down payment and loan options before you get serious about a house.

If you already have a lender, great. If not, I can connect you with someone when you’re ready.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 4 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=4 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=4 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 5 SMS','SMS','Website Buyer Lead',NULL,'What matters most in the house itself: bedrooms, yard, one story, newer home, location, something else?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 5 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=5 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=5 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 5 email','email','Website Buyer Lead','What matters most in the house?','Hi {{first_name}},

Once I know your biggest priorities, it gets much easier to separate homes worth seeing from everything else.

What are the two or three things you really want in the house?

For example: number of bedrooms, one story, yard, newer construction, schools, commute, larger lot, etc.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 5 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=5 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=5 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 6 SMS','SMS','Website Buyer Lead',NULL,'Are you currently renting, already own a home, or staying somewhere else while you look? That can make a big difference in how we plan the timing.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 6 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=6 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=6 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 6 email','email','Website Buyer Lead','One timing question','Hi {{first_name}},

One thing that affects the buying plan is your current housing situation.

Are you renting, do you already own a home, or are you in another situation right now?

If you already own, we can also talk through whether that home would need to be sold before or after you buy.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 6 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=6 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=6 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 7 call','call','Website Buyer Lead','Call {{first_name}} – Day 7 buyer follow-up','One week since website inquiry with no meaningful response. Make a brief follow-up call. Do not continue campaign if they engage.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 7 call' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=7 AND s.channel='call' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='09:30',relative_delay=0,ai_personalization_enabled=0 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=7 AND channel='call';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 7 SMS','SMS','Website Buyer Lead',NULL,'Hi {{first_name}}, I’ve tried to reach you a few times and don’t want to become that agent who stalks your phone forever. Are you still interested in buying, or should I back off for now?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 7 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=7 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=7 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 7 email','email','Website Buyer Lead','Still looking?','Hi {{first_name}},

I’ve reached out a few times since your website inquiry and wanted to make sure I’m not chasing you if your plans changed.

If you’re still interested in buying, reply with even a quick “yes” and I’ll help from there.

If the timing isn’t right, that’s perfectly fine too.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 7 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=7 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=7 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 8 SMS','SMS','Website Buyer Lead',NULL,'If you are still looking, I can also help you compare areas instead of starting with a specific house. Sometimes that’s the easier place to start.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 8 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=8 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=8 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 8 email','email','Website Buyer Lead','Not sure where to start?','Hi {{first_name}},

You don’t have to know exactly what house you want before talking with me.

If you’re deciding between areas, price ranges, new construction vs. resale, or even whether buying makes sense right now, we can start there.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 8 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=8 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=8 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 9 SMS','SMS','Website Buyer Lead',NULL,'When you picture making a move, are you thinking weeks, a few months, or sometime farther out?');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 9 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=9 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=9 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 9 email','email','Website Buyer Lead','What does your timeline look like?','Hi {{first_name}},

Your timeline doesn’t have to be exact.

Are you hoping to move within the next month or two, sometime in the next few months, or are you mostly preparing for later?

Knowing that helps me give you useful advice without rushing you.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 9 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=9 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=9 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 10 SMS','SMS','Website Buyer Lead',NULL,'If you want, I can help you set up a more focused home search instead of relying on whatever happens to pop up online.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 10 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=10 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=10 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 10 email','email','Website Buyer Lead','A more focused home search','Hi {{first_name}},

Once I know your area, price range and biggest priorities, I can help you focus on homes that actually fit.

That usually works better than scrolling through dozens of listings that were never realistic options in the first place.

If you want help narrowing it down, reply with what you’re looking for.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 10 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=10 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=10 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 11 SMS','SMS','Website Buyer Lead',NULL,'Any questions about the buying process itself? Financing, inspections, offers, closing costs, negotiations, whatever. You don’t have to already know how all of this works.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 11 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=11 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=11 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 11 email','email','Website Buyer Lead','Questions about buying?','Hi {{first_name}},

A lot of buyers wait to ask questions because they think they should already understand the process.

You don’t need to.

If you have questions about financing, inspections, offers, closing costs, negotiations or anything else, send them over.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 11 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=11 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=11 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 12 SMS','SMS','Website Buyer Lead',NULL,'If something is keeping you from moving forward right now, feel free to tell me. Timing, rates, payment, needing to sell first, or just uncertainty are all pretty normal.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 12 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=12 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=12 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 12 email','email','Website Buyer Lead','Anything holding things up?','Hi {{first_name}},

Sometimes the most useful conversation isn’t about listings at all.

If there’s something keeping you from moving forward right now, such as timing, payment, financing, needing to sell another home, or just uncertainty about the market, tell me what it is.

I may be able to help you sort through it.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 12 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=12 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=12 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 13 SMS','SMS','Website Buyer Lead',NULL,'Still keeping the door open, {{first_name}}. If buying is still on your radar, just reply and tell me what you need help with.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 13 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=13 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=13 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 13 email','email','Website Buyer Lead','Keeping the door open','Hi {{first_name}},

I know plans change and people get busy.

If buying is still something you’re considering, I’m happy to help whenever the timing makes sense.

Just reply and tell me where things stand.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 13 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=13 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=13 AND channel='email';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 14 call','call','Website Buyer Lead','Call {{first_name}} – final initial follow-up','Final call attempt in the 14-day initial buyer campaign. If no meaningful response, contact will transition to Weekly Nurture.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 14 call' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=14 AND s.channel='call' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='09:30',relative_delay=0,ai_personalization_enabled=0 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=14 AND channel='call';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 14 SMS','SMS','Website Buyer Lead',NULL,'Hi {{first_name}}, this will be my last frequent follow-up. I’ll stop bugging you after today. If you’re still planning to buy, reply anytime and I’ll be glad to help.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 14 SMS' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=14 AND s.channel='SMS' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='10:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=14 AND channel='SMS';
INSERT INTO campaign_messages (name,channel,lead_subtype,subject,body) VALUES ('Website Buyer Lead · Day 14 email','email','Website Buyer Lead','I’ll stop filling up your inbox','Hi {{first_name}},

I haven’t been able to connect with you, so I’m going to stop the frequent follow-up after today.

That doesn’t mean the door is closed.

If buying a home is still on your radar later, reply anytime and I’ll be happy to pick things back up.');
INSERT INTO campaign_step_templates (step_id,lead_subtype,template_id) SELECT s.id,'Website Buyer Lead',m.id FROM campaign_steps s JOIN campaign_messages m ON m.name='Website Buyer Lead · Day 14 email' WHERE s.campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND s.day_number=14 AND s.channel='email' AND NOT EXISTS (SELECT 1 FROM campaign_step_templates x WHERE x.step_id=s.id AND x.lead_subtype='Website Buyer Lead');
UPDATE campaign_steps SET scheduled_time='14:00',relative_delay=0,ai_personalization_enabled=1 WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Buyer Internet Lead - 14 Day Initial Follow-Up' ORDER BY id LIMIT 1) AND day_number=14 AND channel='email';
