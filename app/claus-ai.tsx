"use client";
import { useEffect, useRef, useState } from "react";
type Rec = Record<string, any>;
const date = (value?: string) => {
  if (!value) return "";
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(dayOnly ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium", ...(!dayOnly ? { timeStyle: "short" as const } : {}) }).format(parsed);
};

export function AiProviderStatus() {
  const [status, setStatus] = useState<Rec | null>(null);
  const [indexState, setIndexState] = useState("");
  const [indexing, setIndexing] = useState(false);
  useEffect(() => { fetch("/api/claus-ai").then(r => r.ok ? r.json() as Promise<Rec> : null).then(data => setStatus(data)).catch(() => {}); }, []);
  const buildIndex = async () => {
    setIndexing(true); let total = 0;
    try {
      for (let batch = 0; batch < 200; batch++) {
        const response = await fetch("/api/claus-ai/index", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data = await response.json() as Rec;
        if (!response.ok) throw Error(data.error || "Indexing failed");
        total += Number(data.indexed || 0); setIndexState(`${total} indexed this session · ${data.remaining} remaining`);
        if (!data.remaining || !data.indexed) break;
      }
    } catch (e) { setIndexState(e instanceof Error ? e.message : "Search indexing is unavailable."); }
    finally { setIndexing(false); }
  };
  return <div className="ai-provider-status"><h3>Claus AI</h3>
    {status ? <><div className="future"><span>Status</span><span>{status.status}</span></div>
      <div className="future"><span>Provider · Model</span><span>{status.provider} · {status.model}</span></div>
      <div className="future"><span>Drafting model</span><span>{status.reasoningModel}</span></div>
      <div className="future"><span>Embeddings</span><span>{status.embeddingProvider} · {status.embeddingModel}</span></div>
      <button onClick={buildIndex} disabled={indexing || status.embeddingProvider === "Not configured" || status.embeddingModel === "Not configured"}>{indexing ? "Indexing…" : "Index communication history"}</button>
      {indexState && <p role="status">{indexState}</p>}
      <small>Read-only. Credentials are configured in the Site’s server environment.</small></>
    : <p>Sign in to see AI connection status.</p>}
  </div>;
}

export function AiContactDrafts({ contactId }: { contactId: number }) {
  const [drafts, setDrafts] = useState<Rec[]>([]), [error, setError] = useState("");
  useEffect(() => { fetch(`/api/claus-ai?contactId=${contactId}`).then(r => r.ok ? r.json() as Promise<Rec> : null).then(data => setDrafts(data?.drafts || [])).catch(() => {}); }, [contactId]);
  const review = async (draft: Rec, status: "Copied" | "Edited" | "Dismissed") => {
    if (status === "Copied") await navigator.clipboard.writeText(draft.final_version || draft.generated_draft);
    const recordedStatus = status !== "Dismissed" && draft.final_version && draft.final_version !== draft.generated_draft ? "Edited" : status;
    const response = await fetch("/api/claus-ai", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.id, status: recordedStatus, finalVersion: status === "Dismissed" ? null : draft.final_version || draft.generated_draft }) });
    if (!response.ok) { setError("Could not save draft review."); return; }
    setDrafts(items => items.map(item => item.id === draft.id ? { ...item, status: recordedStatus } : item));
  };
  if (!drafts.length) return null;
  return <section className="sidebar-section ai-contact-drafts"><h3>Suggested replies</h3><p>Review before sending. Claus AI has not sent these messages.</p>
    {drafts.map(d => <div key={d.id} className="ai-contact-draft"><b>{d.medium} · {date(d.occurred_at)}</b>
      <textarea aria-label={`Suggested ${d.medium} reply`} disabled={d.status !== "Suggested"} value={d.final_version ?? d.generated_draft} onChange={e => setDrafts(items => items.map(item => item.id === d.id ? { ...item, final_version: e.target.value } : item))} />
      {JSON.parse(d.risk_flags || "[]").length > 0 && <small>Review: {JSON.parse(d.risk_flags).join("; ")}</small>}
      {d.status === "Suggested" ? <div><button onClick={() => review(d, "Copied")}>Copy</button><button onClick={() => review(d, "Edited")}>Save edit</button><button onClick={() => review(d, "Dismissed")}>Dismiss</button></div> : <small>{d.status}</small>}
    </div>)}{error && <p role="alert">{error}</p>}
  </section>;
}

export function ClausAI({ contacts, initialContactId, clearInitial, open }: { contacts: Rec[]; initialContactId: number | null; clearInitial: () => void; open: (id: number, anchor?: string) => void; }) {
  const [question, setQuestion] = useState(""), [messages, setMessages] = useState<Rec[]>([]),
    [conversationId, setConversationId] = useState(() => typeof window !== "undefined" ? sessionStorage.getItem("claus-ai-conversation") || "" : ""),
    [contextIds, setContextIds] = useState<number[]>([]), [scope, setScope] = useState<number | null>(null),
    [busy, setBusy] = useState(false), [error, setError] = useState(""), [expandedSources, setExpandedSources] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initialContactId) { setScope(initialContactId); setMessages([]); setConversationId(""); setContextIds([initialContactId]); clearInitial(); }
  }, [initialContactId, clearInitial]);
  useEffect(() => {
    if (!conversationId || scope) return;
    fetch(`/api/claus-ai?conversationId=${encodeURIComponent(conversationId)}`).then(r => r.ok ? r.json() as Promise<Rec> : null).then(data => {
      if (data?.history?.length) setMessages(data.history.flatMap((row: Rec) => [
        { role: "user", text: row.question, key: `u${row.id}` },
        { role: "assistant", text: row.answer || "The earlier request failed.", evidence: JSON.parse(row.evidence || "[]"), draft: row.draft_id ? { id: row.draft_id, medium: row.draft_medium, text: row.final_version || row.generated_draft, original: row.generated_draft, riskFlags: JSON.parse(row.risk_flags || "[]"), openQuestions: JSON.parse(row.open_questions || "[]"), reviewStatus: row.draft_status === "Suggested" ? null : row.draft_status } : null, key: `a${row.id}` },
      ]));
    }).catch(() => {});
  }, [conversationId, scope]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);
  const submit = async (prompt = question) => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setError(""); setQuestion("");
    setMessages(items => [...items, { role: "user", text: prompt, key: crypto.randomUUID() }]);
    try {
      const response = await fetch("/api/claus-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt, conversationId, previousContactIds: contextIds, contactId: scope }) });
      const result = await response.json() as Rec;
      if (!response.ok) throw Error(result.error || "Claus AI is temporarily unavailable.");
      setConversationId(result.conversationId); sessionStorage.setItem("claus-ai-conversation", result.conversationId);
      setContextIds(result.contactIds || []);
      setMessages(items => [...items, { role: "assistant", text: result.answer, evidence: result.evidence, total: result.total, draft: result.draft, key: crypto.randomUUID() }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Claus AI is temporarily unavailable."); }
    finally { setBusy(false); }
  };
  const reviewDraft = async (m: Rec, status: "Edited" | "Dismissed" | "Copied") => {
    if (status === "Copied") await navigator.clipboard.writeText(m.draft.text);
    const response = await fetch("/api/claus-ai", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.draft.id, status: m.draft.text === m.draft.original ? status : "Edited", finalVersion: status === "Dismissed" ? null : m.draft.text }) });
    if (!response.ok) { setError("Draft review could not be saved."); return; }
    setMessages(items => items.map(item => item.key === m.key ? { ...item, draft: { ...item.draft, reviewStatus: status } } : item));
  };
  const starters = ["Who needs follow-up today?", "What promises are still open?", "Which Past Clients are talking about selling?", "Who referred clients this year?", "What did Derek say about repairs?"];
  return <section className="claus-ai-page">
    <div className="claus-ai-heading"><div><h2>Claus AI</h2><p>Ask about your CRM. Answers include the records used.</p></div>
      <button onClick={() => { setMessages([]); setConversationId(""); setContextIds([]); setScope(null); sessionStorage.removeItem("claus-ai-conversation"); }}>New conversation</button></div>
    {scope && <div className="claus-ai-scope">About {contacts.find(c => Number(c.id) === scope)?.display_name || contacts.find(c => Number(c.id) === scope)?.first_name || "this contact"} <button onClick={() => setScope(null)}>Clear</button></div>}
    <div className="claus-ai-thread" aria-live="polite">
      {!messages.length && <div className="claus-ai-starters">{starters.map(s => <button key={s} onClick={() => submit(s)}>{s}</button>)}</div>}
      {messages.map((m: Rec) => <div key={m.key} className={`claus-ai-message ${m.role}`}>
        <b>{m.role === "user" ? "You" : "Claus AI"}</b><p>{m.text}</p>
        {m.draft && <div className="claus-ai-draft"><strong>Suggested {m.draft.medium} reply · review before sending</strong><textarea aria-label="Edit suggested reply" value={m.draft.text} onChange={e => setMessages(items => items.map(item => item.key === m.key ? { ...item, draft: { ...item.draft, original: item.draft.original || item.draft.text, text: e.target.value } } : item))} />
          {m.draft.riskFlags?.length > 0 && <p role="alert">Review: {m.draft.riskFlags.join("; ")}</p>}
          {m.draft.openQuestions?.length > 0 && <p>Open questions: {m.draft.openQuestions.join("; ")}</p>}
          <button disabled={!!m.draft.reviewStatus} onClick={() => reviewDraft(m, "Copied")}>Copy draft</button> <button disabled={!!m.draft.reviewStatus} onClick={() => reviewDraft(m, "Edited")}>Save edit</button> <button disabled={!!m.draft.reviewStatus} onClick={() => reviewDraft(m, "Dismissed")}>Dismiss</button>{m.draft.reviewStatus && <small> · {m.draft.reviewStatus}</small>}
        </div>}
        {m.evidence?.length > 0 && <details className="claus-ai-sources"><summary>Sources ({m.total || m.evidence.length})</summary>
          {m.evidence.slice(0, expandedSources.includes(m.key) ? 30 : 10).map((e: Rec, i: number) => <div key={`${e.kind}-${e.id}-${i}`}><button onClick={() => open(Number(e.contactId), `${e.kind === "communication" ? "communication" : e.kind === "note" ? "note" : e.kind === "task" || e.kind === "appointment" ? "task" : e.kind === "opportunity" ? "opportunity" : "contact"}-${e.id}`)}>{e.contact || "Contact"} · {e.kind} {e.date ? `· ${date(e.date)}` : ""}</button><small>{e.excerpt}</small></div>)}
          {m.evidence.length > 10 && !expandedSources.includes(m.key) && <button onClick={() => setExpandedSources(keys => [...keys, m.key])}>Show more sources</button>}
          {(m.total || 0) > m.evidence.length && <small>Showing the first {m.evidence.length} records. Narrow the question for a more specific answer.</small>}
        </details>}</div>)}
      {busy && <p className="claus-ai-thinking">Checking CRM records…</p>}
      {error && <p role="alert" className="claus-ai-error">{error} {error.toLowerCase().includes("sign in") && <a href="/signin-with-chatgpt?return_to=%2F">Sign in</a>}</p>}
      <div ref={bottom} /></div>
    <form className="claus-ai-compose" onSubmit={e => { e.preventDefault(); submit(); }}><input aria-label="Ask Claus AI" placeholder="Ask Claus AI..." value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} /><button className="primary" disabled={!question.trim() || busy} type="submit">Ask</button></form>
  </section>;
}
