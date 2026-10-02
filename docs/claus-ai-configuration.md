# Claus AI configuration

Claus AI reads CRM data through authorized server routes. Configure these values in the Site's **server environment/secrets**, never in client code or GitHub:

| Tier | Provider setting | Model setting | Intended work |
| --- | --- | --- | --- |
| Fast | `AI_FAST_PROVIDER` | `AI_FAST_MODEL` | Routine answers, structured queries, summaries, classification and simple extraction when a model is needed |
| Reasoning | `AI_REASONING_PROVIDER` | `AI_REASONING_MODEL` | SMS/email drafts, ambiguity, changed agreements, conflicting facts and multi-source reasoning |

For Brad's preferred split, set fast to `anthropic` with `claude-haiku-4-5-20251001` and reasoning to `openai`, then choose exact model identifiers for each. Provider identifiers are `openai`, `anthropic`, `google`, and `mistral`. Store the matching credentials separately as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, or `MISTRAL_API_KEY`. Only the providers actually used need keys. An Anthropic API key without a workspace scope also requires server-side `ANTHROPIC_WORKSPACE_ID`; the Anthropic request includes it as `anthropic-workspace-id`. A workspace-scoped Anthropic key does not need this setting. `CRM_OWNER_EMAIL` must remain configured for server-side owner authorization.

The optional `AI_FAST_FALLBACK_PROVIDER` / `AI_FAST_FALLBACK_MODEL` and `AI_REASONING_FALLBACK_PROVIDER` / `AI_REASONING_FALLBACK_MODEL` pairs enable explicit failover for their respective tiers. Without a configured fallback, a provider failure returns an error; a different provider is never selected implicitly. A low-confidence, conflicting, or review-needed fast answer is **escalated to the reasoning tier**, not treated as a provider outage. If reasoning is unconfigured, escalation returns an error instead of guessing.

Legacy `AI_PROVIDER` / `AI_MODEL` values are read for existing installations only. Once tier-specific providers are set, one tier does not inherit the other's provider. Remove legacy values after configuring both tiers to avoid surprising defaults.

Settings displays provider and model names, tier availability and optional fallback names. It never returns provider keys. The first successful response records the actual provider and model used in the turn log, including when an explicit fallback ran. No message is sent automatically; suggested replies require review.

Search embeddings remain independent. Set `EMBEDDING_PROVIDER=openai` and `EMBEDDING_MODEL=text-embedding-3-small`. They reuse the same server-side `OPENAI_API_KEY` as the OpenAI reasoning tier; no second key is needed. Anthropic has no embedding adapter in this app. Source-linked, overlapping 900-character chunks and their vectors remain in D1; no external vector service is needed. Existing deterministic extraction and tool selection run locally and do not require an AI key; any model-based routine work uses the fast tier.

Settings shows index status, indexed records and chunks, pending and failed sources, and last error. Existing history is indexed only when the owner selects **Index communication history**. New SMS, email, completed call/voice transcripts and manual notes queue just the affected source. D1 triggers invalidate embeddings after edits and remove them after deletions. Model changes require the owner to choose **Rebuild semantic index**; old and new vector spaces never mix. Failed sources can be retried. Index batches and embedding queries respect the AI spending limits. Source content is preserved if an embedding request fails.

## Spending limits

Settings → AI Usage shows this month's estimated spend, tier and task totals, projection, daily use, and owner-editable limits. Defaults: monthly target $25, warning $50, hard stop $75; daily hard stop $5; and $0.25 reserved per external request. Set `AI_TEST_MODE=true` to additionally cap the month at `AI_TEST_MONTHLY_LIMIT_USD` (default $10). `AUTO_GENERATE_MESSAGE_DRAFTS` defaults off; the owner can enable it in Settings or manually request a draft for an inbound SMS/email. Short acknowledgments are skipped automatically. Incoming messages and ordinary CRM features continue working if AI is paused.

`AI_FAST_INPUT_USD_PER_MILLION`, `AI_FAST_OUTPUT_USD_PER_MILLION`, `AI_REASONING_INPUT_USD_PER_MILLION`, `AI_REASONING_OUTPUT_USD_PER_MILLION`, and `AI_EMBEDDING_INPUT_USD_PER_MILLION` can calibrate cost estimates to the selected models. Until set, deliberately conservative internal rates of $30 per million input tokens and $120 per million output tokens apply (embeddings count input only). These are budget estimates, **not provider prices**; actual provider billing can differ. Set spending limits at each provider too. Reservations count against limits before requests start, including fallback attempts and semantic embeddings. Failed attempts retain their estimated cost to avoid undercounting uncertain provider charges. Indexing runs only when requested, scans incrementally, and re-embeds changed source content based on its hash.
