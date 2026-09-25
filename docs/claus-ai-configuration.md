# Claus AI configuration

The existing CRM uses Cloudflare D1 and R2. Claus AI queries D1 directly through controlled server functions. It does not copy contacts, communications, tasks or transactions into another CRM store. The derived embedding index is stored in D1 as vectors and searched in small bounded batches by the Worker, so no separate vector database is required at this scale.

Set these values in the Claus CRM Site's **server environment/secrets**:

| Name | Value |
| --- | --- |
| `AI_PROVIDER` | `openai`, `anthropic`, `google` or `mistral` |
| `CRM_OWNER_EMAIL` | Required. Set in Sites runtime settings to the authorized owner email. |
| `AI_MODEL` | The exact model identifier for routine answers |
| `AI_REASONING_MODEL` | Optional model identifier for drafting/complex reasoning; defaults to `AI_MODEL` |
| One matching provider key | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, or `MISTRAL_API_KEY` |
| `EMBEDDING_PROVIDER` | Optional: `openai`, `google`, or `mistral`; independent from `AI_PROVIDER` |
| `EMBEDDING_MODEL` | Exact embedding model identifier for the selected provider |
| Matching embedding provider key | Reuses the corresponding server-side key above |

Only the active provider's key is needed. Anthropic has no embedding adapter here, so choose a separate embedding provider if Anthropic handles chat. The Settings page reports provider/model/status without displaying keys. After setting embedding configuration, use **Index communication history** to process communications and notes incrementally; repeat after edits to existing messages if necessary. New messages are picked up on the next index run. The index never sends full CRM records, only bounded snippets.

Phase 1 does not send messages, create tasks or appointments, edit CRM records or make calls. Draft review changes only the linked Claus AI draft record. Configure provider account retention and data processing terms separately before using client communication content with that provider.

Once the model is configured, newly received, matched SMS and nonhistorical inbound email generate a review-only draft in the contact's Suggested replies panel. The ingest pipeline still saves the incoming message if the provider is unavailable. Existing historical messages are not bulk-drafted.
