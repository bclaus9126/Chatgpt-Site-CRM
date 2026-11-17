INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 1 SMS','SMS',NULL,'Hey {{first_name}}, this is Brad with The Claus Team. Thanks for checking out the home I shared on Facebook! Was there anything specific you wanted to know about it?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 1 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 1 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=1 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 1 Email','email','Thanks for checking out my listing!','Hi {{first_name}},

Thanks for taking a look at the home I shared on Facebook!

I wanted to reach out personally and see if you had any questions about the property. Whether you''d like more information, want to schedule a showing, or are just browsing, I''m happy to help.

Was there something about that home that caught your attention?

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 1 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 1 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=1 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 2 SMS','SMS',NULL,'Hey {{first_name}}, would you be interested in seeing that home in person, or would you rather get a little more information first? Either works for me!' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 2 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 2 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=2 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 2 Email','email','Want to take a closer look?','Hi {{first_name}},

Pictures can give you a pretty good idea of a home, but there''s always more to the story.

If you''re curious about the property you saw on Facebook, I''d be happy to answer questions or arrange a time for you to walk through it.

And if you''re not quite ready for that, no problem. I can help you get the information you need without any pressure to make a decision.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 2 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 2 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=2 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 3 SMS','SMS',NULL,'Quick question, {{first_name}}. Are you interested in that specific house, or are you exploring homes with similar features? I can help with either.' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 3 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 3 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=3 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 3 Email','email','There may be other homes worth considering','Hi {{first_name}},

One thing I''ve learned in real estate is that the house that catches your attention isn''t always the one you end up buying.

Sometimes it simply helps you figure out what you really want.

If the home you saw on Facebook isn''t quite the right fit, I can help you find similar properties that might check more of your boxes.

Just let me know what you''re looking for, and we can go from there.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 3 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 3 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=3 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 4 SMS','SMS',NULL,'When it comes to your next home, what''s the one thing you absolutely don''t want to compromise on? Location, layout, yard, or something else?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 4 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 4 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=4 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 4 Email','email','What''s on your must-have list?','Hi {{first_name}},

Finding the right home gets a lot easier when you know which features matter most to you.

For some people it''s an open layout. For others, it''s a larger yard, a home office, or a particular location.

My suggestion is to start with just two things: your biggest must-have and your biggest dealbreaker.

Those two answers can eliminate a lot of homes that would only waste your time.

What''s at the top of your list?

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 4 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 4 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=4 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 5 SMS','SMS',NULL,'Hey {{first_name}}, is there a particular area you''re hoping to buy in, or are you open to different locations if the right house comes along?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 5 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 5 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=5 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 5 Email','email','The right house in the right location','Hi {{first_name}},

A house can look perfect online, but the location still has to work for your everyday life.

Commute times, nearby amenities, the surrounding neighborhood, and even how the streets feel can make a difference.

If you''re considering a few different areas, I can help you compare the housing options in each one.

Do you already have a location in mind, or are you keeping your options open?

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 5 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 5 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=5 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 6 SMS','SMS',NULL,'Have you settled on a price range you''re comfortable with, {{first_name}}, or are you still figuring out what makes sense financially?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 6 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 6 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=6 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 6 Email','email','A home''s price is only part of the picture','Hi {{first_name}},

Here''s something worth keeping in mind while looking at homes: the purchase price is only one part of the financial picture.

Your interest rate, property taxes, insurance, and any HOA fees can all affect what you''ll actually pay each month.

Two homes with similar asking prices can have noticeably different monthly costs.

If you''d like, I can help you compare the numbers on homes you''re considering so you''re looking beyond just the listing price.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 6 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 6 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=6 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 7 SMS','SMS',NULL,'Curious, {{first_name}}. Do you enjoy touring homes even while you''re still exploring, or do you prefer to narrow things down online first?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 7 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 7 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=7 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 7 Email','email','Why seeing a home in person matters','Hi {{first_name}},

Listing photos have one job: make a home look its best.

What they don''t always show is how the rooms connect, how much natural light comes through, or how the space actually feels when you''re standing in it.

That''s why an in-person showing can be useful, even if you''re still early in your search.

If there''s a home you''d like to see, I can help arrange a visit when it works for your schedule.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 7 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 7 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=7 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 8 SMS','SMS',NULL,'Have you already spoken with a lender about buying, or are you still in the early stages of figuring everything out?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 8 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 8 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=8 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 8 Email','email','One step that can make buying easier','Hi {{first_name}},

If you''re planning to finance a home purchase, getting preapproved can make the process a lot easier.

It gives you a better understanding of your potential budget and helps you prepare when you find a home you really like.

You don''t have to be ready to buy tomorrow to start learning about your financing options.

If you''re unsure where to begin, I''m happy to explain the process or help you connect with a lender.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 8 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 8 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=8 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 9 SMS','SMS',NULL,'Are you hoping to make a move sometime in the next few months, or is buying a home more of a longer-term plan for you?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 9 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 9 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=9 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 9 Email','email','There''s no one-size-fits-all timeline','Hi {{first_name}},

One of the first things I like to understand when helping someone buy a home is their timeline.

Some buyers need to move quickly. Others are exploring their options and waiting until the timing feels right.

Both approaches are completely reasonable.

The important thing is having the information you need to make a decision when you''re ready, instead of feeling rushed.

Do you have a general timeframe in mind?

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 9 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 9 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=9 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 10 SMS','SMS',NULL,'Here''s a question for you, {{first_name}}. If you had to choose, would you rather have a little more house or a little lower monthly payment?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 10 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 10 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=10 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 10 Email','email','The tradeoffs that come with buying a home','Hi {{first_name}},

Very few homes check absolutely every box. Even great properties usually involve a tradeoff somewhere.

Maybe you find a home with a fantastic layout but a smaller yard. Or a great location with a little less square footage.

The trick is figuring out which compromises you''ll be comfortable living with and which ones might lead to regret.

Knowing your priorities ahead of time can make those decisions much easier.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 10 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 10 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=10 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 11 SMS','SMS',NULL,'Would you consider a home that needs a few cosmetic updates, or are you looking for something completely move-in ready?' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 11 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 11 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=11 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 11 Email','email','Move-in ready or room to make it your own?','Hi {{first_name}},

Something worth thinking about during your home search is how much work you''re comfortable taking on after moving in.

A home with dated paint or finishes might offer opportunities to make it your own. But bigger repairs deserve a much closer look before making an offer.

Knowing where you stand on updates and renovations can open up some options, or help us rule out properties that aren''t worth your time.

Which direction sounds more like you?

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 11 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 11 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=11 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 12 SMS','SMS',NULL,'If you come across a home and want to know more than what the listing shows, feel free to send it my way. I''m happy to help you dig into the details.' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 12 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 12 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=12 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 12 Email','email','What listing photos won''t tell you','Hi {{first_name}},

It''s easy to get caught up in the pictures when looking at homes online. But there are some important things those photos can''t tell you.

Property condition, potential restrictions, ongoing ownership costs, and other details can all influence whether a home is actually a good fit.

That''s where having someone help you look beyond the listing can make a difference.

If you find a property you''re curious about, send it over. I''ll be happy to help you figure out what questions are worth asking.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 12 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 12 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=12 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 13 SMS','SMS',NULL,'Hey {{first_name}}, would you rather I send you homes that might be a good fit, or just be available whenever you have questions? I''m good either way.' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 13 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 13 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=13 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 13 Email','email','Let me know what would be most helpful','Hi {{first_name}},

I know everyone''s approach to looking for a home is a little different.

Some people like receiving listings as soon as something promising comes along. Others prefer to browse on their own and reach out when they have a question.

I''m comfortable with either approach.

My goal is to be a useful resource, not another person cluttering up your inbox.

Just let me know what works best for you.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 13 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 13 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=13 AND channel='email';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 14 SMS','SMS',NULL,'Hey {{first_name}}, I''ll leave things with you after this. If you ever want to tour a home, get more details, or just talk through your options, you can reach me right here. - Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 14 SMS');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 14 SMS' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=14 AND channel='SMS';
--> statement-breakpoint
INSERT INTO campaign_messages(name,channel,subject,body) SELECT 'Facebook Buyer Lead Day 14 Email','email','Here whenever you''re ready','Hi {{first_name}},

I wanted to send one last note before wrapping up my follow-ups.

Whether you''re ready to buy next month, next year, or you''re simply curious about what''s on the market, I''m happy to be a resource.

Buying a home is a big decision, and you should never feel rushed into making it.

Whenever you have questions, find a property you like, or want a little guidance on where to start, you can reach me by replying to this email or calling or texting me at 210-787-8556.

Thanks again for checking out my listing, and I hope we get a chance to work together.

Brad' WHERE NOT EXISTS(SELECT 1 FROM campaign_messages WHERE name='Facebook Buyer Lead Day 14 Email');
--> statement-breakpoint
UPDATE campaign_steps SET template_id=(SELECT id FROM campaign_messages WHERE name='Facebook Buyer Lead Day 14 Email' ORDER BY id DESC LIMIT 1) WHERE campaign_id=(SELECT id FROM campaign_templates WHERE name='Facebook Buyer Lead - Initial 14 day Follow-up' ORDER BY id LIMIT 1) AND day_number=14 AND channel='email';
