# Claus AI regression set

Run `node --experimental-strip-types --test tests/claus-ai-retrieval.test.mjs` for deterministic retrieval checks. The cases below are the model evaluation set; compare each configured provider and model using the same CRM snapshot and save output, latency, usage and review notes from `claus_ai_turns`.

| Question | Expected check |
| --- | --- |
| Summarize Alex Example. | Current relationship, intent and stage; relevant seller context and recent communications. No invented facts. |
| What did Alex say about repairs? | Alex's relevant SMS or call, correct date and clickable communication source. |
| Which Past Clients are Seller intent? | Database filter on relationship and intent. |
| What appointments do I have this week? | Database date filter using the America/Chicago calendar week; no arbitrary time for date-only appointments. |
| What promises are still open? | Open accepted commitments, linked source and no duplicate linked tasks. |
| Who mentioned downsizing? | Relevant messages or notes, with a source; no unsupported matches. |
| Friday 9 AM proposed, 10 AM countered, 10 AM accepted. What time was agreed? | 10 AM, with speaker and message evidence. Earlier proposal must not be called current. |
| Earlier budget $450,000; later confirmed $500,000. What is the current budget? | $500,000, with current fact distinguished from history. |

Keep test data deidentified outside production. Do not send all CRM records or whole transcripts to a model for evaluation. Semantic indexing is incremental; evaluate unstructured queries only after the Settings index reports zero remaining.

Known constraints: the simple keyword fallback is narrower than embeddings; ambiguous appointment/price supersession still requires model review; there is no automatic nightly index job yet. A provider outage or unconfigured model must not mutate CRM records.
