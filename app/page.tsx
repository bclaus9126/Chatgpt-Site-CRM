"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Handshake,
  CheckSquare,
  MessagesSquare,
  Settings,
  Search,
  Plus,
  Phone,
  MessageSquare,
  Mail,
  NotebookPen,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
  Menu,
  Flame,
  MapPin,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  Mic,
  Pause,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import { relationshipOptions, intentOptions, stageGroups, stageOptions } from "@/lib/contact-classification";
import { splitContactAddress } from "@/lib/contact-address";
import { ClausAI, AiProviderStatus, AiContactDrafts } from "./claus-ai";
type Rec = Record<string, any>;
type Data = {
  contacts: Rec[];
  opportunities: Rec[];
  tasks: Rec[];
  notes: Rec[];
  communications: Rec[];
  properties: Rec[];
  activities: Rec[];
  relationships: Rec[];
  intelligence: Rec[];
  relationshipMoments: Rec[];
  communicationSuggestions: Rec[];
};
const empty: Data = {
  contacts: [],
  opportunities: [],
  tasks: [],
  notes: [],
  communications: [],
  properties: [],
  activities: [],
  relationships: [],
  intelligence: [],
  relationshipMoments: [],
  communicationSuggestions: [],
};
const nav = [
  ["Today", LayoutDashboard],
  ["Contacts", Users],
  ["Opportunities", Handshake],
  ["Tasks", CheckSquare],
  ["Communications", MessagesSquare],
  ["Claus AI", Sparkles],
  ["Settings", Settings],
] as const;
const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const storedDateTime = (value: string) => {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  return new Date(`${value.replace(" ", "T")}Z`);
};
const validDate = (value?: string) => {
  if (!value || value === "CURRENT_TIMESTAMP") return false;
  return !Number.isNaN((isDateOnly(value) ? new Date(`${value}T12:00:00Z`) : storedDateTime(value)).getTime());
};
const when = (s?: string) => {
  if (!validDate(s)) return "Date unavailable";
  if (isDateOnly(s)) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${s}T12:00:00Z`));
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(storedDateTime(s));
};
const whenDetailed = (s?: string) =>
  validDate(s)
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(storedDateTime(s))
    : "Date unavailable";
const duration = (seconds?: number) => {
  if (!seconds) return "Duration pending";
  const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
};
const overdueDays = (date?: string) => {
  if (!date) return 0;
  const due = new Date(`${date.slice(0, 10)}T12:00:00`), now = new Date(`${today()}T12:00:00`);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
};
export default function Home() {
  const [data, setData] = useState<Data>(empty),
    [view, setView] = useState("Today"),
    [selected, setSelected] = useState<Rec | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(""),
    [mobile, setMobile] = useState(false);
  const [aiContactId, setAiContactId] = useState<number | null>(null);
  async function load() {
    try {
      const r = await fetch("/api/crm");
      if (r.status === 401) { setError("Sign in to access Claus CRM."); return; }
      if (r.status === 403) { setError("This account is not authorized for Claus CRM."); return; }
      if (!r.ok) throw Error();
      setData(await r.json());
      setError("");
    } catch {
      setError("Your CRM data could not be loaded. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }
  async function act(payload: Rec) {
    const r = await fetch("/api/crm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      setError("That change was not saved. Please try again.");
      return false;
    }
    setData(await r.json());
    setModal("");
    return true;
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("microsoft")) setView("Settings");
    load();
    const checkMail = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/microsoft/status");
        if (!response.ok) return;
        const status = await response.json() as Rec;
        if (status.connected && (!status.lastSyncedAt || Date.now() - Date.parse(status.lastSyncedAt) > 15 * 60000 || !status.notificationsActive)) {
          await fetch("/api/microsoft/sync", { method: "POST" });
          await load();
        }
      } catch { /* Manual sync remains available in Settings. */ }
    };
    checkMail();
    const mailRefresh = window.setInterval(checkMail, 15 * 60000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    return () => { window.clearInterval(refresh); window.clearInterval(mailRefresh); };
  }, []);
  const filtered = useMemo(
    () =>
      data.contacts.filter((c) =>
        (
          c.first_name +
          " " +
          c.last_name +
          " " +
          (c.email || "") +
          " " +
          (c.phone || "")
        )
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data.contacts, search],
  );
  const go = (n: string) => {
    setView(n);
    setSelected(null);
    setMobile(false);
  };
  return (
    <div className={`app-shell${selected || view === "Contacts" ? " contacts-font-up" : ""}`}>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="mark">C</div>
          <div>
            <b>Claus CRM</b>
            <span>Relationship desk</span>
          </div>
          <button className="close-side" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([n, I]) => (
            <button
              key={n}
              className={view === n && !selected ? "active" : ""}
              onClick={() => go(n)}
            >
              <I />
              <span>{n}</span>
              {n === "Tasks" &&
                data.tasks.filter(
                  (t) => t.status !== "Completed" && t.due_date < today(),
                ).length > 0 && (
                  <i>
                    {
                      data.tasks.filter(
                        (t) => t.status !== "Completed" && t.due_date < today(),
                      ).length
                    }
                  </i>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">BC</div>
          <div>
            <b>Brad Claus</b>
            <span>Agent workspace</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Close menu"
          className="scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header>
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <p className="eyebrow">
              {selected ? "CONTACT RECORD" : "CLAUS CRM"}
            </p>
            <h1>
              {selected ? selected.first_name + " " + selected.last_name : view}
            </h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <Search />
              <input
                aria-label="Search contacts"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                onFocus={() => go("Contacts")}
              />
            </label>
            <button className="primary" onClick={() => setModal("contact")}>
              <Plus />
              New contact
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error">
              <AlertTriangle />
              {error}
              {error === "Sign in to access Claus CRM." && <a href="/signin-with-chatgpt?return_to=%2F">Sign in</a>}
            </div>
          )}
          {loading ? (
            <Loading />
          ) : selected ? (
            <ContactPage
              c={data.contacts.find((contact) => contact.id === selected.id) || selected}
              data={data}
              act={act}
              modal={modal}
              setModal={setModal}
              reload={load}
              back={() => setSelected(null)}
              askAi={() => { setAiContactId(Number(selected.id)); setSelected(null); setView("Claus AI"); }}
            />
          ) : view === "Today" ? (
            <TodayDashboard
              data={data}
              open={(c) => setSelected(c)}
              go={go}
              act={act}
            />
          ) : view === "Contacts" ? (
            <Contacts contacts={filtered} open={setSelected} />
          ) : view === "Opportunities" ? (
            <Opportunities
              data={data}
              open={(id) =>
                setSelected(data.contacts.find((c) => c.id === id) || null)
              }
            />
          ) : view === "Tasks" ? (
            <Tasks
              data={data}
              act={act}
              open={(id) =>
                setSelected(data.contacts.find((c) => c.id === id) || null)
              }
            />
          ) : view === "Communications" ? (
            <Communications />
          ) : view === "Claus AI" ? (
            <ClausAI contacts={data.contacts} initialContactId={aiContactId} clearInitial={() => setAiContactId(null)} open={(id, anchor) => {
              const contact = data.contacts.find(c => Number(c.id) === id);
              if (contact) { setSelected(contact); if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100); }
            }} />
          ) : (
            <SettingsPage act={act} />
          )}
        </div>
      </main>
      {modal === "contact" && (
        <ContactModal close={() => setModal("")} act={act} />
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading">
      <div />
      <div />
      <div />
    </div>
  );
}
function TodayDashboard({ data, open, go, act }: { data: Data; open: (c: Rec) => void; go: (s: string) => void; act: (p: Rec) => Promise<boolean> }) {
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState<Rec | null>(null);
  const [draftDate, setDraftDate] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  const day = today();
  const contact = (id: number) => data.contacts.find(c => c.id === id);
  const name = (c?: Rec) => c ? `${c.first_name} ${c.last_name}` : "Contact unavailable";
  const openContact = (id: number) => { const c = contact(id); if (c) open(c); };
  const active = data.tasks.filter(t => !["Completed", "Cancelled", "No-show"].includes(t.status));
  const appointments = active.filter(t => t.type === "Appointment" && t.due_date?.slice(0, 10) === day).sort((a,b) => (a.due_time || "99:99").localeCompare(b.due_time || "99:99"));
  const tasks = active.filter(t => t.type !== "Appointment" && t.due_date && t.due_date.slice(0,10) <= day);
  const promises = tasks.filter(t => { try { return !!JSON.parse(t.details || "{}").commitment; } catch { return false; } });
  const ordinaryTasks = tasks.filter(t => !promises.includes(t));
  const overdueFollowups = data.contacts.filter(c => c.next_follow_up && c.next_follow_up.slice(0,10) < day).sort((a,b) => a.next_follow_up.localeCompare(b.next_follow_up));
  const dueFollowups = data.contacts.filter(c => c.next_follow_up?.slice(0,10) === day);
  const inbound = data.communications.filter(m => m.direction?.toLowerCase().includes("inbound") && m.contact_id && !m.is_sample && (!m.occurred_at || Date.now() - storedDateTime(m.occurred_at).getTime() < 14 * 864e5)).filter(m => !data.communications.some(other => other.contact_id === m.contact_id && other.direction?.toLowerCase().includes("outbound") && storedDateTime(other.occurred_at).getTime() > storedDateTime(m.occurred_at).getTime())).sort((a,b) => storedDateTime(b.occurred_at).getTime() - storedDateTime(a.occurred_at).getTime());
  const moments = data.relationshipMoments.filter(m => { const d = m.date_value?.slice(5,10); if (!d) return false; const thisYear = `${day.slice(0,4)}-${d}`; let offset = (Date.parse(`${thisYear}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 864e5; if (offset < 0) offset = (Date.parse(`${Number(day.slice(0,4))+1}-${d}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 864e5; return offset >= 0 && offset <= 7; });
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const schedule = (item: Rec) => { setEditing(item); setDraftDate(item.due_date?.slice(0,10) || day); };
  const contactActions = (c: Rec) => <span className="today-actions">{c.phone && <><a href={`tel:${c.phone}`}>Call</a><a href={`sms:${c.phone}`}>Text</a></>}{c.email && <a href={`mailto:${c.email}`}>Email</a>}<button onClick={() => open(c)}>Open contact</button></span>;
  const taskRow = (t: Rec) => <div className="today-row" key={t.id}><div><strong>{t.title}</strong><span><button className="today-link" onClick={() => openContact(t.contact_id)}>{t.contact_name || name(contact(t.contact_id))}</button> · {when(t.due_date)}{t.due_time ? ` at ${t.due_time}` : " · Time not set"}</span>{t.notes && <small>{t.notes}</small>}{t.source_system && <small>Source: {t.source_system}</small>}</div><span className="today-actions"><button onClick={() => act({action:"completeTask",id:t.id})}>Complete</button><button onClick={() => schedule(t)}>Reschedule</button><button onClick={() => openContact(t.contact_id)}>Open contact</button></span></div>;
  const section = (id: string, title: string, count: number, emptyText: string, rows: React.ReactNode) => <section className="today-section" id={id}><h3>{title} <span>{count}</span></h3>{count ? rows : <p className="today-empty">{emptyText}</p>}</section>;
  return <div className="today-board"><section className="today-intro"><span>{new Intl.DateTimeFormat("en-US", { timeZone:"America/Chicago", weekday:"long", month:"long", day:"numeric" }).format(now)}</span><h2>Good {Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",hour:"numeric",hourCycle:"h23"}).format(now)) < 12 ? "morning" : "afternoon"}, Brad.</h2><p>Here’s what needs your attention.</p><div className="today-counts">{[["Overdue follow-ups",overdueFollowups.length,"overdue-followups"],["Tasks due",tasks.length,"today-tasks"],["Appointments",appointments.length,"today-appointments"],["Recent inbound",inbound.length,"recent-inbound"],["Open promises",promises.length,"promises"]].map(([label,count,id]) => <button key={String(id)} onClick={() => jump(String(id))}><b>{count}</b> {label}</button>)}</div></section>
  {section("overdue-followups","Overdue Follow-Ups",overdueFollowups.length,"No overdue follow-ups.",overdueFollowups.map(c => <div className="today-row urgent" key={c.id}><div><button className="today-link" onClick={() => open(c)}><strong>{name(c)}</strong></button><span>{overdueDays(c.next_follow_up)} days overdue · {[c.relationship,c.intent,c.stage].filter(Boolean).join(" · ")}</span><small>Last contact: {when(c.last_meaningful_contact)}{c.recommended_next_action ? ` · ${c.recommended_next_action}` : ""}</small></div><span className="today-actions">{contactActions(c)}<button onClick={() => act({action:"completeFollowUp",contactId:c.id})}>Complete</button><button onClick={() => schedule({contact_id:c.id,followup:true,due_date:c.next_follow_up})}>Reschedule</button></span></div>))}
  {section("today-appointments","Today’s Appointments",appointments.length,"No appointments today.",appointments.map(t => { const c=contact(t.contact_id); let detail: Rec={}; try {detail=JSON.parse(t.details||"{}");} catch {} return <div className="today-row" key={t.id}><div><strong>{t.due_time || "Time not set"} · {t.title}</strong><span><button className="today-link" onClick={() => openContact(t.contact_id)}>{t.contact_name}</button>{detail.location ? ` · ${detail.location}` : ""}</span>{detail.propertyAddress && <small>{detail.propertyAddress}</small>}<small>{t.calendar_sync_status === "synced" ? "Synced to Outlook" : t.calendar_sync_status === "failed" ? "Sync failed" : "Calendar sync pending"}{t.notes ? ` · ${t.notes}` : ""}</small></div><span className="today-actions">{c && contactActions(c)}{detail.propertyAddress && <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.propertyAddress)}`}>Directions</a>}<button onClick={() => act({action:"completeTask",id:t.id})}>Completed</button><button onClick={() => schedule(t)}>Reschedule</button>{t.calendar_sync_status === "failed" && <button onClick={async()=>{await fetch("/api/microsoft/calendar/retry",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:t.id})});window.location.reload();}}>Retry sync</button>}</span></div>; }))}
  {section("today-tasks","Tasks Due / Overdue",ordinaryTasks.length,"You’re caught up on tasks due today.",ordinaryTasks.sort((a,b)=>(a.due_date||"").localeCompare(b.due_date||"")).map(taskRow))}
  {section("recent-inbound","Recent Inbound",inbound.length,"No unanswered inbound messages in the last 14 days.",inbound.slice(0,20).map(m => <div className="today-row" key={m.id}><div><button className="today-link" onClick={() => openContact(m.contact_id)}><strong>{name(contact(m.contact_id))}</strong></button><span>{m.type} · {whenDetailed(m.occurred_at)} · No later outbound response recorded</span><small>{(m.message_transcript || m.subject || m.ai_summary || "Inbound communication").slice(0,180)}</small></div>{contact(m.contact_id) && contactActions(contact(m.contact_id)!)}</div>))}
  {section("promises","Promises & Commitments",promises.length,"No open promises with a due date.",promises.map(taskRow))}
  {section("followups-today","Follow-Ups Today",dueFollowups.length,"No follow-ups scheduled today.",dueFollowups.map(c => <div className="today-row" key={c.id}><div><button className="today-link" onClick={() => open(c)}><strong>{name(c)}</strong></button><span>{c.recommended_next_action || "Follow up"} · {c.stage || "Stage unknown"}</span><small>Last contact: {when(c.last_meaningful_contact)}</small></div><span className="today-actions">{contactActions(c)}<button onClick={() => act({action:"completeFollowUp",contactId:c.id})}>Complete</button><button onClick={() => schedule({contact_id:c.id,followup:true,due_date:c.next_follow_up})}>Reschedule</button></span></div>))}
  {section("relationship-moments","Relationship Moments",moments.length,"No relationship moments in the next 7 days.",moments.map(m => <div className="today-row" key={m.id}><div><strong>{m.label || m.type}</strong><span><button className="today-link" onClick={() => openContact(m.contact_id)}>{name(contact(m.contact_id))}</button> · {m.date_value?.slice(5,10)}</span></div>{contact(m.contact_id) && contactActions(contact(m.contact_id)!)}</div>))}
  <div className="today-footer"><button onClick={() => go("Tasks")}>View all tasks</button><button onClick={() => go("Opportunities")}>View transactions</button></div>
  {editing && <Modal title={editing.followup ? "Reschedule follow-up" : "Reschedule item"} close={() => setEditing(null)}><form onSubmit={async e => { e.preventDefault(); if (await act(editing.followup ? {action:"rescheduleFollowUp",contactId:editing.contact_id,dueDate:draftDate} : {action:"rescheduleTask",id:editing.id,dueDate:draftDate})) setEditing(null); }}><label>New date<input type="date" required value={draftDate} onChange={e=>setDraftDate(e.target.value)}/></label><div className="today-actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit">Save date</button></div></form></Modal>}
  </div>;
}
function Dashboard({
  data,
  open,
  go,
  act,
}: {
  data: Data;
  open: (c: Rec) => void;
  go: (s: string) => void;
  act: (p: Rec) => void;
}) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const centralDate = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(clock),
    centralHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hourCycle: "h23",
      }).format(clock),
    ),
    greeting =
      centralHour < 12 ? "morning" : centralHour < 17 ? "afternoon" : "evening",
    openTasks = data.tasks.filter((t) => t.status !== "Completed"),
    due = openTasks.filter((t) => t.due_date === today()),
    over = openTasks.filter((t) => t.due_date < today());
  const cards = [
    [
      "New leads",
      data.contacts.filter((c) => c.relationship === "Lead").length,
      "this database",
      Users,
    ],
    ["Due today", due.length, "follow-ups", Clock],
    ["Overdue", over.length, "needs attention", AlertTriangle],
    [
      "Active buyers",
      data.opportunities.filter(
        (o) => o.type.includes("Buyer") && o.stage === "Active Client",
      ).length,
      "opportunities",
      Handshake,
    ],
    [
      "Potential sellers",
      data.contacts.filter((c) => c.intent.includes("Seller")).length,
      "relationships",
      Flame,
    ],
    [
      "Active listings",
      data.opportunities.filter((o) => o.stage === "Active Listing").length,
      "listings",
      MapPin,
    ],
    [
      "Active contracts",
      data.opportunities.filter((o) => o.stage === "Under Contract").length,
      "transactions",
      CheckSquare,
    ],
    [
      "Quiet leads",
      data.contacts.filter(
        (c) =>
          c.last_meaningful_contact &&
          Date.now() - new Date(c.last_meaningful_contact + "Z").getTime() >
            14 * 864e5,
      ).length,
      "14+ days",
      MessagesSquare,
    ],
  ];
  return (
    <>
      <section className="welcome">
        <div>
          <p>{centralDate}</p>
          <h2>Good {greeting}, Brad.</h2>
          <span>Here’s who needs you next.</span>
        </div>
        <button className="ghost" onClick={() => go("Tasks")}>
          Open task list
          <ChevronRight />
        </button>
      </section>
      <section className="metric-grid">
        {cards.map(([l, v, s, I]: any) => (
          <button
            className={
              "metric " + (l === "Overdue" && Number(v) > 0 ? "urgent" : "")
            }
            key={l}
            onClick={() =>
              l === "Overdue" || l === "Due today"
                ? go("Tasks")
                : go("Contacts")
            }
          >
            <span>
              <I />
            </span>
            <div>
              <strong>{v}</strong>
              <b>{l}</b>
              <small>{s}</small>
            </div>
          </button>
        ))}
      </section>
      <div className="dash-grid">
        <section className="panel">
          <PanelHead
            title="Today’s follow-ups"
            sub="Who, why, and what happens next"
            action="View all"
            onClick={() => go("Tasks")}
          />
          <div className="follow-list">
            {[...over, ...due].slice(0, 5).map((t) => {
              const c = data.contacts.find((x) => x.id === t.contact_id);
              return (
                <div className="follow" key={t.id}>
                  <button className="person" onClick={() => c && open(c)}>
                    <Avatar c={c} />
                    <span>
                      <b>{t.contact_name}</b>
                      <small>{t.title}</small>
                    </span>
                  </button>
                  <div className="why">
                    <b>{t.notes || c?.concerns || "Follow-up due"}</b>
                    <small>
                      {t.due_date < today() ? "Overdue" : "Due"}{" "}
                      {t.due_time || ""}
                    </small>
                  </div>
                  <button
                    className="done"
                    onClick={() => act({ action: "completeTask", id: t.id })}
                  >
                    Done
                  </button>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel next">
          <PanelHead title="Upcoming tasks" sub="The next few things on deck" />
          <div className="task-mini">
            {openTasks
              .filter((t) => t.due_date >= today())
              .slice(0, 5)
              .map((t) => (
                <div key={t.id}>
                  <span className="datebox">
                    <b>{new Date(t.due_date + "T12:00").getDate()}</b>
                    <small>
                      {new Date(t.due_date + "T12:00").toLocaleDateString(
                        "en-US",
                        { month: "short" },
                      )}
                    </small>
                  </span>
                  <p>
                    <b>{t.title}</b>
                    <small>{t.contact_name}</small>
                  </p>
                </div>
              ))}
          </div>
        </section>
      </div>
      <div className="sample-banner">
        <b>Sample workspace</b>
        <span>
          The five example contacts are marked sample data and can be removed
          later.
        </span>
      </div>
    </>
  );
}
function PanelHead({
  title,
  sub,
  action,
  onClick,
}: {
  title: string;
  sub: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-head">
      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
      {action && (
        <button onClick={onClick}>
          {action}
          <ChevronRight />
        </button>
      )}
    </div>
  );
}
function Contacts({
  contacts,
  open,
}: {
  contacts: Rec[];
  open: (c: Rec) => void;
}) {
  const [relationship, setRelationship] = useState(""), [intent, setIntent] = useState(""), [stage, setStage] = useState("");
  const visible = contacts.filter((c) => (!relationship || c.relationship === relationship) && (!intent || c.intent === intent) && (!stage || c.stage === stage));
  return (
    <section className="panel table-panel">
      <PanelHead
        title="People, not records"
        sub={`${visible.length} of ${contacts.length} contacts`}
      />
      <div className="contact-classification-filters">
        <label>Relationship<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option value="">All relationships</option>{relationshipOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Intent<select value={intent} onChange={(e) => setIntent(e.target.value)}><option value="">All intents</option>{intentOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Stage<select value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option>{Object.entries(stageGroups).map(([group, values]) => <optgroup key={group} label={group}>{values.map((value) => <option key={value}>{value}</option>)}</optgroup>)}</select></label>
      </div>
      <div className="contact-table">
        <div className="tr th">
          <span>Contact</span>
          <span>Relationship</span>
          <span>Intent</span>
          <span>Stage</span>
          <span>Temperature</span>
          <span>Next follow-up</span>
          <span />
        </div>
        {visible.map((c) => (
          <button className="tr" key={c.id} onClick={() => open(c)}>
            <span className="contact-cell">
              <Avatar c={c} />
              <span>
                <b>
                  {c.first_name} {c.last_name}
                </b>
                <small>{c.email}</small>
              </span>
            </span>
            <span>
              <Badge>{c.relationship}</Badge>
            </span>
            <span>{c.intent}</span>
            <span>{c.stage || "—"}</span>
            <span>
              <Temp t={c.temperature} />
            </span>
            <span>
              <b>{when(c.next_follow_up)}</b>
              <small>{c.recommended_next_action}</small>
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>
    </section>
  );
}
function Opportunities({
  data,
  open,
}: {
  data: Data;
  open: (id: number) => void;
}) {
  return (
    <>
      <div className="summary-row">
        <article>
          <small>Pipeline value</small>
          <b>
            {money(
              data.opportunities.reduce(
                (a, o) => a + (o.estimated_price || 0),
                0,
              ),
            )}
          </b>
        </article>
        <article>
          <small>Projected commission</small>
          <b>
            {money(
              data.opportunities.reduce(
                (a, o) =>
                  a +
                  ((o.estimated_commission || 0) * (o.probability || 0)) / 100,
                0,
              ),
            )}
          </b>
        </article>
        <article>
          <small>Open opportunities</small>
          <b>
            {
              data.opportunities.filter(
                (o) => !["Closed", "Lost"].includes(o.stage),
              ).length
            }
          </b>
        </article>
      </div>
      <section className="pipeline">
        {[
          "New Lead",
          "Connected",
          "Nurture",
          "Appointment Set",
          "Active Client",
          "Under Contract",
        ].map((stage) => (
          <div className="column" key={stage}>
            <h3>
              {stage}
              <span>
                {data.opportunities.filter((o) => o.stage === stage).length}
              </span>
            </h3>
            {data.opportunities
              .filter((o) => o.stage === stage)
              .map((o) => (
                <button
                  className="opp"
                  key={o.id}
                  onClick={() => open(o.contact_id)}
                >
                  <small>{o.type}</small>
                  <b>{o.contact_name}</b>
                  <span>{money(o.estimated_price)}</span>
                  <p>{o.expected_timeframe}</p>
                  <div>
                    <i style={{ width: `${o.probability || 0}%` }} />
                  </div>
                </button>
              ))}
          </div>
        ))}
      </section>
    </>
  );
}
function Tasks({
  data,
  act,
  open,
}: {
  data: Data;
  act: (p: Rec) => void;
  open: (id: number) => void;
}) {
  const groups = [
    [
      "Overdue",
      data.tasks.filter(
        (t) => t.status !== "Completed" && t.due_date < today(),
      ),
    ],
    [
      "Today",
      data.tasks.filter(
        (t) => t.status !== "Completed" && t.due_date === today(),
      ),
    ],
    [
      "Upcoming",
      data.tasks.filter(
        (t) => t.status !== "Completed" && t.due_date > today(),
      ),
    ],
    ["Completed", data.tasks.filter((t) => t.status === "Completed")],
  ];
  return (
    <section className="panel">
      <PanelHead
        title="Tasks & follow-up"
        sub="Overdue work stays at the top until it’s handled"
      />
      {groups.map(([name, list]: any) => (
        <div className="task-group" key={name}>
          <h3 className={name === "Overdue" ? "red" : ""}>
            {name}
            <span>{list.length}</span>
          </h3>
          {list.map((t: Rec) => (
            <div className="task-row" key={t.id}>
              <button
                className={
                  "check " + (t.status === "Completed" ? "checked" : "")
                }
                onClick={() =>
                  t.status !== "Completed" &&
                  act({ action: "completeTask", id: t.id })
                }
              >
                ✓
              </button>
              <button className="task-copy" onClick={() => open(t.contact_id)}>
                <b>{t.title}</b>
                <span>
                  {t.contact_name} · {when(t.due_date)} {t.due_time || ""}
                </span>
                <small>{t.notes}</small>
              </button>
              <Badge>{t.type}</Badge>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
function Communications() {
  const [events, setEvents] = useState<Rec[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function loadEvents() {
    setLoading(true);
    try {
      const r = await fetch("/api/telnyx/events");
      if (!r.ok) throw Error();
      const body = (await r.json()) as { events?: Rec[] };
      setEvents(body.events || []);
      setError("");
    } catch {
      setError("The Telnyx event log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadEvents();
  }, []);
  return (
    <section className="panel telnyx-log">
      <PanelHead
        title="Telnyx event log"
        sub="The 100 most recent verified voice events"
        action="Refresh"
        onClick={loadEvents}
      />
      {error && (
        <div className="error">
          <AlertTriangle />
          {error}
        </div>
      )}
      {loading ? (
        <div className="event-loading">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="event-empty">
          <div className="empty-icon">
            <Phone />
          </div>
          <h2>No Telnyx events yet</h2>
          <p>
            New call, recording, and transcription events will appear here
            automatically.
          </p>
        </div>
      ) : (
        <div className="event-table">
          <div className="event-row event-head">
            <span>Received</span>
            <span>Event</span>
            <span>Direction</span>
            <span>From</span>
            <span>To</span>
            <span>Call ID</span>
          </div>
          {events.map((event) => (
            <div className="event-row" key={event.id}>
              <span>
                {new Date(
                  (event.received_at || "").replace(" ", "T") + "Z",
                ).toLocaleString()}
              </span>
              <span>
                <Badge>{event.event_type}</Badge>
              </span>
              <span>{event.direction || "—"}</span>
              <span>{event.from_number || "—"}</span>
              <span>{event.to_number || "—"}</span>
              <span
                className="event-id"
                title={event.call_control_id || event.event_id}
              >
                {event.call_control_id || event.event_id}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function SettingsPage({ act }: { act: (p: Rec) => Promise<boolean> }) {
  const [section, setSection] = useState("Workspace");
  return (
    <section className="settings-layout">
      <aside className="settings-nav panel">
        <button className={section === "Workspace" ? "active" : ""} onClick={() => setSection("Workspace")}>Workspace</button>
        <button className={section === "Data Import" ? "active" : ""} onClick={() => setSection("Data Import")}><FileSpreadsheet /> Data Import</button>
      </aside>
      {section === "Data Import" ? <FubImporter act={act} /> : <div className="settings-grid">
        <article className="panel">
          <h2>Workspace</h2>
          <label>CRM name<input value="Claus CRM" readOnly /></label>
          <label>Owner<input value="Brad Claus" readOnly /></label>
          <label>Primary market<input value="Schertz · Cibolo · New Braunfels" readOnly /></label>
        </article>
        <article className="panel">
          <h2>Connections</h2>
          <div className="future"><span>Telnyx calling</span><Badge>Available</Badge></div>
          <div className="future"><span>Follow Up Boss imports</span><Badge>Available</Badge></div>
          <AiProviderStatus />
          <MicrosoftConnection />
        </article>
      </div>}
    </section>
  );
}

function MicrosoftConnection() {
  const [status, setStatus] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async () => {
    try {
      const response = await fetch("/api/microsoft/status");
      if (!response.ok) throw Error();
      setStatus(await response.json());
    } catch { setMessage("Connection status unavailable."); }
  };
  useEffect(() => {
    refresh();
    const result = new URLSearchParams(window.location.search).get("microsoft");
    if (result) {
      setMessage(result === "connected" ? "Microsoft 365 connected. Recent mail is available for review." : result === "connected-sync-pending" ? "Connected. The first mail sync needs another try." : "Microsoft connection did not finish. Check the account and try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const connect = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/microsoft/connect", { method: "POST" });
      const body = await response.json() as Rec;
      if (!response.ok) throw Error(body.error || "Could not start Microsoft sign-in.");
      window.location.assign(body.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not connect."); setBusy(false); }
  };
  const sync = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/microsoft/sync", { method: "POST" });
      const body = await response.json() as Rec;
      if (!response.ok) throw Error(body.error || "Sync failed.");
      setMessage(`Mail sync finished. ${body.imported} new messages matched contacts.${body.truncated ? " Older mail is outside this sync window." : ""}${body.notificationsActive ? "" : " Automatic notifications need attention."}`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed."); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Microsoft 365? Imported emails will stay in Claus CRM.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/microsoft/disconnect", { method: "POST" });
      if (!response.ok) throw Error("Could not disconnect.");
      setMessage("Microsoft 365 disconnected.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not disconnect."); }
    finally { setBusy(false); }
  };
  return <div className="microsoft-connection">
    <div className="future"><span>Microsoft 365 · {status?.mailbox || "Your mailbox"}</span><Badge>{status?.connected ? "Connected" : "Not connected"}</Badge></div>
    {status?.ownedByAnotherAccount ? <p>Sign in with the Claus CRM account that connected this mailbox.</p> : status?.connected ? <>
      <p>Last sync: {status.lastSyncedAt ? whenDetailed(status.lastSyncedAt) : "Not yet"}. {status.notificationsActive ? "New mail notifications are active." : "New mail notifications need renewal; sync to retry."}</p>
      <div className="connection-actions">{!status.canSend && <button onClick={connect} disabled={busy}>Approve sending permission</button>}{!status.calendarEnabled && <button onClick={connect} disabled={busy}>Enable Outlook calendar sync</button>}<button onClick={sync} disabled={busy}>{busy ? "Working…" : "Sync now"}</button><button onClick={disconnect} disabled={busy}>Disconnect</button></div>
    </> : <>
      <p>Access to your Microsoft 365 inbox, sent mail, and sending from your connected mailbox. Messages appear under matched contacts.</p>
      <button onClick={connect} disabled={busy || !status?.configured}>{busy ? "Working…" : "Connect Microsoft 365"}</button>
      {status && !status.configured && <div className="microsoft-setup">
        <strong>One-time Microsoft setup needed</strong>
        <p>The CRM cannot open Microsoft sign-in yet because its Microsoft app registration is incomplete. Open Claus CRM directly in a regular browser after these settings are added.</p>
        <ol>
          <li>In <a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer">Microsoft Entra admin center</a>, register an app for your work account. Choose the accounts in your organization and add a <b>Web</b> redirect URI:</li>
        </ol>
        <code>https://claus-crm.bclaus.chatgpt.site/api/microsoft/callback</code>
        <ol start={2}>
          <li>Add delegated Microsoft Graph permissions <b>User.Read</b>, <b>Mail.Read</b>, and <b>Mail.Send</b>. Grant consent if your organization requires it.</li>
          <li>Create a client secret. In the Site’s server environment settings, add <code>MS_CLIENT_ID</code> (application ID), <code>MS_TENANT_ID</code> (directory ID), and <code>MS_CLIENT_SECRET</code> (secret value). Keep the secret out of chat and source code.</li>
          <li>Publish the Site to apply those settings. Then open <a href="https://claus-crm.bclaus.chatgpt.site/" target="_blank" rel="noreferrer">Claus CRM</a> directly, return here, and select <b>Connect Microsoft 365</b>.</li>
        </ol>
        <p>The CRM also needs its server encryption key (<code>MS_TOKEN_KEY</code>); this is already present. The connection status above will change to Connected after Microsoft sign-in completes.</p>
      </div>}
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}

function FubImporter({ act }: { act: (p: Rec) => Promise<boolean> }) {
  const [file, setFile] = useState<File | null>(null), [analysis, setAnalysis] = useState<Rec | null>(null),
    [jobs, setJobs] = useState<Rec[]>([]), [busy, setBusy] = useState(""), [message, setMessage] = useState(""),
    [decisions, setDecisions] = useState<Record<string, string>>({}), [jobRows, setJobRows] = useState<Record<string, Rec[]>>({});
  const loadJobs = async () => { const r = await fetch("/api/imports/fub"); if (r.ok) setJobs((await r.json()).jobs || []); };
  useEffect(() => { loadJobs(); }, []);
  const submit = async (mode: "analyze" | "import") => {
    if (!file) return;
    setBusy(mode); setMessage("");
    const form = new FormData(); form.append("file", file); form.append("decisions", JSON.stringify(decisions));
    try {
      const r = await fetch(`/api/imports/fub?mode=${mode}`, { method: "POST", body: form });
      const body = await r.json(); if (!r.ok) throw Error(body.error || "Import failed");
      if (mode === "analyze") { setAnalysis(body.analysis); setDecisions(Object.fromEntries((body.analysis.duplicates || []).map((d: Rec) => [String(d.row), "skip"]))); }
      else { setMessage(`${body.imported} contacts imported. ${body.skipped} held for duplicate review.`); setAnalysis(null); setFile(null); await loadJobs(); }
    } catch (e) { setMessage(e instanceof Error ? e.message : "The file could not be processed."); }
    finally { setBusy(""); }
  };
  const rollback = async (jobId: number) => {
    if (!window.confirm("Rollback this import? Only records created by this job will be removed.")) return;
    setBusy(`rollback-${jobId}`);
    const r = await fetch("/api/imports/fub?mode=rollback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId }) });
    if (r.ok) setJobs((await r.json()).jobs || []); else setMessage("Rollback could not be completed.");
    setBusy("");
  };
  const inspect = async (jobId: number) => {
    if (jobRows[String(jobId)]) { setJobRows({ ...jobRows, [String(jobId)]: [] }); return; }
    const r = await fetch(`/api/imports/fub?jobId=${jobId}`); if (r.ok) setJobRows({ ...jobRows, [String(jobId)]: (await r.json()).rows || [] });
  };
  const metrics = analysis ? [
    ["Contacts found", analysis.total], ["Valid mobile numbers", analysis.mobile], ["Email addresses", analysis.emails],
    ["Text messages", analysis.texts], ["Calls", analysis.calls], ["Notes", analysis.notes], ["Transactions", analysis.transactions],
    ["Home anniversaries", analysis.anniversaries], ["Relationship records", analysis.relationships], ["Birthdays", analysis.birthdays],
    ["Referral relationships", analysis.referrals], ["Malformed records", analysis.malformed], ["Possible duplicates", analysis.duplicates?.length || 0],
  ] : [];
  const cleanCount = analysis ? Math.max(0, Number(analysis.total || 0) - Number(analysis.duplicates?.length || 0) - Number(analysis.errors?.length || 0)) : 0;
  return <div className="import-page">
    <div className="crumb">Settings <ChevronRight /> Data Import <ChevronRight /> <b>Follow Up Boss</b></div>
    <article className="panel import-hero">
      <div><span className="import-icon"><FileSpreadsheet /></span><h2>Follow Up Boss import</h2><p>Upload a current FUB contact export. Claus CRM will analyze the file before changing any contact data.</p></div>
      <label className="file-drop"><Upload /><b>{file ? file.name : "Choose FUB CSV"}</b><span>{file ? "Ready to analyze" : "CSV files up to 15 MB"}</span><input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setAnalysis(null); setMessage(""); }} /></label>
      <button className="primary" disabled={!file || !!busy} onClick={() => submit("analyze")}>{busy === "analyze" ? "Analyzing…" : "Analyze file"}</button>
      {message && <p className="import-message">{message}</p>}
    </article>
    {analysis && <article className="panel analysis-card">
      <div className="analysis-head"><div><CheckCircle2 /><div><h2>Follow Up Boss export detected</h2><p>Preview complete. Nothing has been imported yet.</p></div></div><Badge>{analysis.total} rows</Badge></div>
      <div className="import-metric-grid">{metrics.map(([label, value]) => <div key={label as string}><b>{value}</b><span>{label}</span></div>)}</div>
      <div className="review-box"><b>Import review</b><p>{cleanCount} new contacts can be imported. {analysis.duplicates?.length || 0} existing matches will be skipped. Files can contain up to 100 contacts. Merging into existing contacts remains unavailable. Any unrecognized call or text fragment remains in the original source row for review.</p></div>
      {(analysis.unknownColumns?.length > 0 || analysis.errors?.length > 0 || analysis.warnings?.length > 0) && <div className="review-box"><b>Review before import</b><p>{analysis.unknownColumns?.length || 0} unknown columns are preserved in source rows. {analysis.errors?.length || 0} malformed rows block the import. {(analysis.warnings || []).map((w: Rec) => `Row ${w.row}: ${w.message}`).join(" ")}</p></div>}
      <details className="duplicate-review" open><summary>Preview each contact</summary>{(analysis.contacts || []).map((c: Rec) => <div key={c.row}><b>Row {c.row}: {c.name || "Missing name"}</b><span> — {c.match}</span><p>{c.phones} phones · {c.emails} emails · {c.calls} calls · {c.texts} texts · {c.notes} notes · {c.relationships} relationships · {c.referrals} referrals · {c.transactions} transactions</p><small>Birthday: {c.birthday || "—"} · Home anniversary: {c.homeAnniversary || "—"}</small>{c.samples?.length > 0 && <details className="communication-preview"><summary>Inspect parsed calls and texts</summary>{c.samples.map((item: Rec, index: number) => <div key={index}><b>{item.kind} · {new Date(item.timestamp).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</b><span>{item.sender} → {item.recipient} · {item.direction}</span><p>{item.body || "No visible message body"}</p></div>)}</details>}</div>)}</details>
      {analysis.duplicates?.length > 0 && <details className="duplicate-review"><summary>Review {analysis.duplicates.length} possible duplicates</summary>{analysis.duplicates.map((d: Rec) => <div key={d.row}><span>Row {d.row}: {d.name}</span><Badge>{d.type}</Badge><small>{d.reason}; this contact will be skipped.</small></div>)}</details>}
      {cleanCount === 0 && <p className="import-message" role="status">No new contacts to import. Every row matches an existing contact, so importing this file would add nothing. Existing contacts and their history will not be updated by this import.</p>}
      {analysis.total > 100 && <p className="import-message" role="status">This file has more than 100 contacts. Split it into smaller files to import.</p>}
      <div className="import-actions"><button onClick={() => setAnalysis(null)}>Choose another file</button><button className="primary" disabled={!!busy || cleanCount === 0 || analysis.total > 100 || analysis.errors?.length > 0} onClick={() => submit("import")}>{busy === "import" ? "Importing…" : `Import ${cleanCount} new contact${cleanCount === 1 ? "" : "s"}`}</button></div>
    </article>}
    <article className="panel import-history"><div className="section-head"><div><h2>Import history</h2><p>Every imported row retains its original FUB data and provenance.</p></div><button onClick={() => { if (window.confirm("Normalize classifications from original FUB Stage values? Manually changed contacts will be skipped.")) act({ action: "normalizeFubClassifications" }); }}>Normalize earlier FUB classifications</button></div>
      {jobs.length === 0 ? <p className="empty-copy">No Follow Up Boss imports yet.</p> : <div className="job-table"><div className="job-row job-head"><span>File</span><span>Status</span><span>Imported</span><span>Duplicates</span><span>Errors</span><span></span></div>{jobs.map((job) => <div className="job-entry" key={job.id}><div className="job-row"><span><b>{job.file_name}</b><small>{when(job.created_at)}</small></span><span><Badge>{job.status}</Badge></span><span>{job.imported_records}</span><span>{job.duplicate_records}</span><span>{job.error_count}</span><span className="job-actions"><button onClick={() => inspect(job.id)}>Inspect</button>{job.status !== "Rolled back" && <button className="rollback" onClick={() => rollback(job.id)} disabled={!!busy}><RotateCcw /> Rollback</button>}</span></div>{jobRows[String(job.id)]?.length > 0 && <div className="job-details">{jobRows[String(job.id)].map((row) => <div key={row.row_number}><b>Row {row.row_number}</b><Badge>{row.status}</Badge><span>{row.error || row.warning || row.match_type || "Imported cleanly"}</span></div>)}</div>}</div>)}</div>}
    </article>
  </div>;
}
function ContactPage({
  c,
  data,
  act,
  modal,
  setModal,
  back,
  askAi,
  reload,
}: {
  c: Rec;
  data: Data;
  act: (p: Rec) => Promise<boolean>;
  modal: string;
  setModal: (s: string) => void;
  back: () => void;
  askAi: () => void;
  reload: () => Promise<void>;
}) {
  const [timelineFilter, setTimelineFilter] = useState("All"),
    [tagInput, setTagInput] = useState(""),
    [savingTags, setSavingTags] = useState(false),
    [callState, setCallState] = useState(""),
    [callError, setCallError] = useState(""),
    [callCommunicationId, setCallCommunicationId] = useState<number | null>(
      null,
    ),
    notes = data.notes.filter((n) => n.contact_id === c.id),
    tasks = data.tasks.filter((t) => t.contact_id === c.id),
    opps = data.opportunities.filter((o) => o.contact_id === c.id),
    acts = data.activities.filter((a) => a.contact_id === c.id),
    comms = data.communications.filter((item) => item.contact_id === c.id),
    relationships = data.relationships.filter((item) => item.contact_id === c.id),
    moments = data.relationshipMoments.filter((item) => item.contact_id === c.id),
    tags = (c.tags || "")
      .split(",")
      .map((tag: string) => tag.trim())
      .filter(Boolean);
  const saveTags = async (nextTags: string[]) => {
    setSavingTags(true);
    await act({ action: "updateTags", contactId: c.id, tags: nextTags });
    setSavingTags(false);
  };
  const addTag = async () => {
    const cleaned = tagInput.trim().replace(/^#+/, "").replace(/\s+/g, "-");
    if (!cleaned) return;
    const nextTag = `#${cleaned.toLowerCase()}`;
    if (!tags.some((tag: string) => tag.toLowerCase() === nextTag)) {
      await saveTags([...tags, nextTag]);
    }
    setTagInput("");
  };
  const dial = async () => {
    setCallState("Calling Brad");
    setCallError("");
    try {
      const response = await fetch("/api/telnyx/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId: c.id }),
      });
      const body = (await response.json()) as {
        error?: string;
        status?: string;
        communicationId?: number;
      };
      if (!response.ok) throw Error(body.error || "Could not start the call");
      setCallState(body.status || "Calling Brad");
      setCallCommunicationId(body.communicationId || null);
    } catch (error) {
      setCallState("");
      setCallError(
        error instanceof Error ? error.message : "Could not start the call",
      );
    }
  };
  const activeCallStatus = callCommunicationId
    ? comms.find((item) => item.id === callCommunicationId)?.status || callState
    : callState;
  const timeline = [
    ...comms.map((item) => ({
      ...item,
      timelineId: `communication-${item.id}`,
      timelineType: String(item.type || "Call"),
      timelineDate: item.occurred_at,
    })),
    ...notes.map((item) => ({
      ...item,
      timelineId: `note-${item.id}`,
      timelineType: "Note",
      timelineDate: validDate(item.created_at) ? item.created_at : comms.find((communication) => communication.id === Number(item.source_record_id))?.occurred_at,
    })),
    ...tasks.map((item) => ({
      ...item,
      timelineId: `task-${item.id}`,
      timelineType: item.type === "Appointment" ? "Appointment" : "Task",
      timelineDate: [item.completed_at, item.created_at, item.due_date].find(validDate),
    })),
    ...opps.map(item => ({...item,timelineId:`opportunity-${item.id}`,timelineType:"Transaction",timelineDate:item.created_at})),
    ...acts
      .filter((item) => item.type !== "note" && !(["transaction","opportunity"].includes(String(item.type).toLowerCase()) && opps.some(opp => Number(item.source_id) === opp.id)))
      .map((item) => ({
        ...item,
        timelineId: `activity-${item.id}`,
        timelineType: ["transaction", "opportunity"].includes(String(item.type).toLowerCase())
          ? "Transaction"
          : String(item.type || "Relationship"),
        timelineDate: item.occurred_at,
      })),
  ].sort(
    (a, b) =>
      (validDate(b.timelineDate) ? storedDateTime(b.timelineDate).getTime() : 0) - (validDate(a.timelineDate) ? storedDateTime(a.timelineDate).getTime() : 0),
  );
  const filteredTimeline = timeline.filter((item) => {
    if (timelineFilter === "All") return true;
    const type = item.timelineType.toLowerCase();
    return timelineFilter === "Voice Memos"
      ? type.includes("voice memo")
      : timelineFilter === "Texts"
      ? type.includes("text") || type.includes("sms")
      : timelineFilter === "Calls"
        ? type.includes("call")
        : timelineFilter === "Emails"
          ? type.includes("email")
          : timelineFilter === "Notes"
            ? type.includes("note")
            : timelineFilter === "Tasks"
              ? type.includes("task")
              : timelineFilter === "Appointments"
                ? type.includes("appointment")
                : type.includes("transaction") || type.includes("opportunity");
  });
  const upcomingTasks = tasks
    .filter((task) => task.status !== "Completed")
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const appointments = tasks.filter((task) => task.type === "Appointment" && !["Cancelled", "Completed"].includes(task.status));
  const activeOpps = opps.filter((opp) => !["Closed", "Lost"].includes(opp.stage));
  const followUpOverdue = overdueDays(c.next_follow_up);
  const buyer = c.intent === "Buyer" || c.intent === "Buyer + Seller";
  const seller = c.intent === "Seller" || c.intent === "Buyer + Seller";
  const facts = data.intelligence.filter(item => item.contact_id === c.id);
  const buyerFacts = facts.filter(item => /buyer|financ|property_interest/i.test(`${item.category} ${item.field_name}`));
  const sellerFacts = facts.filter(item => /seller|listing|price_expectation|equity/i.test(`${item.category} ${item.field_name}`));
  const otherFacts = facts.filter(item => !buyerFacts.includes(item) && !sellerFacts.includes(item) && !/address|relationship|motivation|concern|personal/i.test(`${item.category} ${item.field_name}`));
  const buyerFields = [["Desired property",c.desired_property],["Target locations",c.target_locations],["Price range",c.price_range],["Financing",c.financing_type],["Timeline",c.estimated_timeline || c.timeframe]].filter(([,value]) => value);
  const sellerFields = [["Seller property",c.property_address],["Listing timeline",c.selling_timeline],["Selling reason",c.selling_reason],["Property status",c.property_status]].filter(([,value]) => value);
  const showFacts = (items: Rec[]) => items.map(item => <CompactField key={item.id} label={String(item.field_name || item.category).replaceAll("_", " ")} value={String(item.value)} />);
  return (
    <>
      <button className="back" onClick={back}>
        ← Back to contacts
      </button>
      <section className="contact-hero">
        <div className="contact-title">
          <Avatar c={c} />
          <div>
            <div>
              <h2>
                {c.display_name || `${c.first_name} ${c.last_name}`}
              </h2>
              <button className="identity-edit" onClick={() => setModal("edit-contact")}>Edit contact</button>
              <button className="identity-edit" onClick={askAi}><Sparkles /> Ask Claus AI about this contact</button>
              {c.is_sample === 1 && <em>SAMPLE DATA</em>}
            </div>
            <p>
              {[c.phone,c.email].filter(Boolean).join(" · ")}
            </p>
            {c.address && <p className="contact-address"><MapPin aria-hidden="true" />{c.address}</p>}
            <div className="contact-tags">
              <span className="tag-list">
                {tags.map((tag: string) => (
                  <span className="badge contact-tag" key={tag}>
                    {tag}
                    <button
                      aria-label={`Remove ${tag}`}
                      disabled={savingTags}
                      onClick={() => saveTags(tags.filter((item: string) => item !== tag))}
                      type="button"
                    >
                      <X />
                    </button>
                  </span>
                ))}
              </span>
              <form
                className="tag-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  addTag();
                }}
              >
                <input
                  aria-label="New contact tag"
                  disabled={savingTags}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="Add tag"
                  value={tagInput}
                />
                <button disabled={savingTags || !tagInput.trim()} type="submit">
                  <Plus /> Add
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="quick">
          <button
            onClick={dial}
            disabled={[
              "Calling Brad",
              "Brad answered",
              "Calling contact",
              "Connected",
            ].includes(activeCallStatus)}
          >
            <Phone />
            {[
              "Calling Brad",
              "Brad answered",
              "Calling contact",
              "Connected",
            ].includes(activeCallStatus)
              ? "Call active"
              : "Call"}
          </button>
          <button title="Text integration is not yet available" type="button"><MessageSquare /> Text</button>
          <button onClick={() => setModal("email")} type="button"><Mail /> Email</button>
          <button onClick={() => setModal("note")}>
            <NotebookPen />
            Add note
          </button>
          <button className="voice-memo-action" onClick={() => setModal("voice-memo")}>
            <Mic />
            Record voice memo
          </button>
          <button className="primary" onClick={() => setModal("task")}><Plus /> Add task</button>
          <button onClick={() => setModal("appointment")}><Plus /> Add appointment</button>
          <button onClick={() => setModal("transaction")}><Plus /> Add transaction</button>
        </div>
      </section>
      {(activeCallStatus || callError) && (
        <div className={callError ? "call-feedback error" : "call-feedback"}>
          <Phone /> {callError || activeCallStatus}
        </div>
      )}
      <section className="contact-facts">
        {([ ["Relationship", "relationship", relationshipOptions], ["Intent", "intent", intentOptions], ["Stage", "stage", stageOptions] ] as const).map(([label, field, values]) => <label className="classification-field" key={field}><small>{label}</small><select value={(values as readonly string[]).includes(c[field]) ? c[field] : ""} onChange={(e) => act({ action: "updateClassification", contactId: c.id, field, value: e.target.value })}><option value="" disabled>{c[field] || "Choose"}</option>{values.map((value) => <option key={value}>{value}</option>)}</select></label>)}
        {[
          ["Lead source", c.lead_source],
          ["Temperature", c.temperature],
          ["Last contact", when(c.last_meaningful_contact)],
          ["Next follow-up", when(c.next_follow_up)],
        ].map(([k, v]) => (
          <div key={k} className={k === "Next follow-up" && followUpOverdue ? "overdue-fact" : ""}>
            <small>{k}</small>
            <b>{v || "—"}</b>
            {k === "Next follow-up" && followUpOverdue > 0 && (
              <em>{followUpOverdue} {followUpOverdue === 1 ? "day" : "days"} overdue</em>
            )}
          </div>
        ))}
      </section>
      <div className="contact-command-center">
        <main className="contact-timeline panel">
          <div className="timeline-toolbar">
            <div>
              <h2>Relationship timeline</h2>
              <p>Calls, messages, notes, tasks, appointments, and transaction activity.</p>
            </div>
            {timelineFilter === "Notes" && <button className="timeline-note" onClick={() => setModal("note")}><Plus /> Note</button>}
          </div>
          <div className="timeline-filters" role="tablist" aria-label="Timeline filters">
            {["All", "Voice Memos", "Texts", "Calls", "Emails", "Notes", "Tasks", "Appointments", "Transactions"].map((filter) => (
              <button
                aria-selected={timelineFilter === filter}
                className={timelineFilter === filter ? "active" : ""}
                key={filter}
                onClick={() => setTimelineFilter(filter)}
                role="tab"
              >{filter}</button>
            ))}
          </div>
          {["Texts", "Emails"].includes(timelineFilter) && <SmsIntelligence contactId={c.id} channel={timelineFilter === "Emails" ? "email" : "sms"} suggestions={data.communicationSuggestions.filter((suggestion) => comms.some((communication) => communication.id === suggestion.communication_id && (timelineFilter === "Emails" ? communication.type === "Email" : ["SMS", "Text"].includes(communication.type))))} reload={reload} />}
          <div className="unified-timeline">
            {filteredTimeline.length === 0 ? (
              <div className="timeline-empty">No {timelineFilter.toLowerCase()} recorded for this contact yet.</div>
            ) : filteredTimeline.map((item) => <div id={item.timelineId} key={item.timelineId}>
              {String(item.timelineType).toLowerCase().includes("voice memo") ? (
                <VoiceMemoRecord item={item} suggestions={data.communicationSuggestions.filter((suggestion) => suggestion.communication_id === item.id)} reload={reload} />
              ) : String(item.timelineType).toLowerCase().includes("call") ? (
                <CallRecord c={c} item={item} suggestions={data.communicationSuggestions.filter((suggestion) => suggestion.communication_id === item.id)} reload={reload} />
              ) : (
                <TimelineRecord c={c} item={item} act={act} />
              )}</div>,
            )}
          </div>
        </main>
        <aside className="contact-sidebar">
          <AiContactDrafts contactId={Number(c.id)} />
          <SidebarSection title="Relationship intelligence" open>
            <CompactField label="Summary" value={c.relationship_summary} />
            <CompactField label="Personal context" value={c.contextual_notes} />
            <CompactField label="Spouse / partner" value={c.spouse_name} />
            <CompactField label="Motivation" value={c.motivation} />
            <CompactField label="Concern" value={c.concerns} />
            <CompactField label="Next action" value={c.recommended_next_action} accent />
          </SidebarSection>
          {activeOpps.length > 0 && <SidebarSection title="Current opportunity" open>
            {activeOpps.map((opp) => <div className="sidebar-opportunity" key={opp.id}>
              <div><b>{opp.type}</b><span>{opp.stage}</span></div>
              {opp.estimated_price && <CompactField label="Expected value" value={money(opp.estimated_price)} />}
              <CompactField label="Target timeline" value={opp.expected_timeframe} />
              <CompactField label="Property" value={opp.property_address} />
              <CompactField label="Next step" value={opp.notes || c.recommended_next_action} />
            </div>)}
          </SidebarSection>}
          <SidebarSection title="Real Estate Profile" open>
            {(buyer || buyerFacts.length > 0 || buyerFields.length > 0) && <div className="profile-group"><h4>Buyer Needs</h4>{buyerFields.map(([label,value]) => <CompactField key={label} label={String(label)} value={String(value)} />)}{showFacts(buyerFacts)}{!buyerFields.length && !buyerFacts.length && <p className="compact-empty">No buyer details recorded.</p>}</div>}
            {(seller || sellerFacts.length > 0 || sellerFields.length > 0) && <div className="profile-group"><h4>Seller Details</h4>{sellerFields.map(([label,value]) => <CompactField key={label} label={String(label)} value={String(value)} />)}{showFacts(sellerFacts)}{!sellerFields.length && !sellerFacts.length && <p className="compact-empty">No seller details recorded.</p>}</div>}
            {showFacts(otherFacts)}
            {!buyer && !seller && !buyerFacts.length && !sellerFacts.length && !buyerFields.length && !sellerFields.length && !otherFacts.length && <p className="compact-empty">No real estate details recorded.</p>}
          </SidebarSection>
          <SidebarSection title="Tasks" open>
            <button className="sidebar-add" onClick={() => setModal("task")}><Plus /> Add task</button>
            {upcomingTasks.filter((task) => task.type !== "Appointment").slice(0, 5).map((task) => (
              <div className={`sidebar-task ${task.due_date < today() ? "overdue" : ""}`} key={task.id}>
                <button className="task-check" aria-label={`Mark ${task.title} complete`} onClick={() => act({ action: "completeTask", id: task.id })}><CheckSquare /></button>
                <span className="sidebar-task-copy"><b>{task.title}</b><span>{task.due_date < today() ? "Overdue · " : ""}{when(task.due_date)}</span></span><button onClick={() => setModal(`task:${task.id}`)}>Edit</button>
              </div>
            ))}
            {upcomingTasks.filter((task) => task.type !== "Appointment").length === 0 && <p className="compact-empty">No open tasks.</p>}
          </SidebarSection>
          <SidebarSection title="Appointments">
            <button className="sidebar-add" onClick={() => setModal("appointment")}><Plus /> Add appointment</button>
            {appointments.map((item) => <div className="sidebar-task" key={item.id}><button className="task-check" aria-label={`Mark ${item.title} complete`} onClick={() => act({ action: "completeTask", id: item.id })}><CheckSquare /></button><span className="sidebar-task-copy"><b>{item.title}</b><span>{when(item.due_date)} · {item.due_time || "Time not set"}</span><small>Calendar sync: {({synced:"Synced to Outlook",pending:"Sync pending",waiting_for_time:"Waiting for time",failed:"Sync failed",not_synced:"Not synced"} as Record<string,string>)[item.calendar_sync_status] || (item.due_time ? "Not synced" : "Waiting for time")}</small>{item.calendar_sync_error && <small>{item.calendar_sync_error}</small>}{item.calendar_sync_status === "failed" && <button onClick={async()=>{await fetch("/api/microsoft/calendar/retry",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id})});await reload()}}>Retry sync</button>}</span><button onClick={() => setModal(`appointment:${item.id}`)}>Edit</button></div>)}
            {appointments.length === 0 && <p className="compact-empty">No upcoming appointments.</p>}
          </SidebarSection>
          <SidebarSection title="Transactions" open>
            <button className="sidebar-add" onClick={() => setModal("transaction")}><Plus /> Add transaction</button>
            {opps.map(opp => <div className="sidebar-opportunity" key={opp.id}><div><b>{opp.type} · {opp.property_address || "Address to add"}</b><span>{opp.stage}</span></div><button onClick={() => setModal(`transaction:${opp.id}`)}>Edit transaction</button></div>)}
            {opps.length === 0 && <p className="compact-empty">No transactions yet.</p>}
          </SidebarSection>
          {(c.birthday || moments.length > 0) && <SidebarSection title="Important dates">
            {c.birthday && <CompactField label="Birthday" value={when(c.birthday)} />}
            {moments.map((moment) => <CompactField key={moment.id} label={moment.label} value={when(moment.date_value)} />)}
          </SidebarSection>}
          {relationships.length > 0 && <SidebarSection title="Relationships & referrals">
            {relationships.map((relationship) => <CompactField
              key={relationship.id}
              label={relationship.relationship_type}
              value={[relationship.related_first_name, relationship.related_last_name].filter(Boolean).join(" ") || "Linked contact"}
            />)}
          </SidebarSection>}
        </aside>
      </div>
      {modal === "note" && (
        <NoteModal c={c} close={() => setModal("")} act={act} />
      )}{" "}
      {modal === "task" && (
        <TaskModal c={c} close={() => setModal("")} act={act} />
      )}
      {modal.startsWith("task:") && <RecordModal kind="task" c={c} existing={tasks.find(t => t.id === Number(modal.split(":")[1]))} close={() => setModal("")} act={act} />}
      {modal === "edit-contact" && <RecordModal kind="contact" c={c} close={() => setModal("")} act={act} />}
      {modal === "email" && <EmailModal c={c} close={() => setModal("")} reload={reload} />}
      {modal.startsWith("appointment") && <RecordModal kind="appointment" c={c} existing={tasks.find(t => t.id === Number(modal.split(":")[1]))} close={() => setModal("")} act={act} />}
      {modal.startsWith("transaction") && <RecordModal kind="transaction" c={c} existing={opps.find(o => o.id === Number(modal.split(":")[1]))} close={() => setModal("")} act={act} />}
      {modal === "voice-memo" && (
        <VoiceMemoModal c={c} close={() => setModal("")} reload={reload} />
      )}
    </>
  );
}

function SmsIntelligence({ contactId, channel = "sms", suggestions, reload }: { contactId: number; channel?: "sms" | "email"; suggestions: Rec[]; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [editing, setEditing] = useState<number | null>(null), [draft, setDraft] = useState<Rec>({});
  const pending = suggestions.filter((item) => item.status === "Suggested");
  const run = async () => {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/${channel}/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactId }) });
      const body = await response.json() as Rec; if (!response.ok) throw Error(body.error || "Text analysis failed"); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Text analysis failed"); } finally { setBusy(false); }
  };
  const decide = async (items: Rec[], dismiss = false) => {
    setBusy(true); setError("");
    try { const groups = new Map<number, Rec[]>(); for (const item of items) groups.set(item.communication_id, [...(groups.get(item.communication_id) || []), item]);
      for (const [communicationId, group] of groups) {
      const response = await fetch(`/api/voice-memos/${communicationId}/suggestions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: group.map((item) => item.id), dismiss }) });
      if (!response.ok) throw Error((await response.json() as Rec).error || "Could not save suggestions");
    } await reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save suggestions"); } finally { setBusy(false); }
  };
  const saveEdit = async (item: Rec) => {
    setBusy(true); setError("");
    try { const response = await fetch("/api/sms/suggestions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, contactId, title: draft.title, dueDate: draft.due_date, dueTime: draft.due_time, fieldValue: draft.field_value }) });
      if (!response.ok) throw Error((await response.json() as Rec).error || "Could not edit suggestion"); setEditing(null); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not edit suggestion"); } finally { setBusy(false); }
  };
  return <section className="sms-intelligence"><div className="sms-intelligence-head"><div><b>AI Interpretation</b><p>Review proposed facts and actions from recent conversation context. {channel === "email" ? "Imported emails are analyzed only when you choose." : "Imported texts are analyzed only when you choose."}</p></div><button disabled={busy} onClick={run}>{busy ? "Working…" : "Analyze conversation"}</button></div>
    {error && <p role="alert">{error}</p>}
    {pending.length > 0 && <div className="memo-suggestions">{pending.map((item) => <div className="sms-suggestion" key={item.id}><div><b>{item.category}{item.commitment ? " · PROMISED" : ""}</b><strong>{item.title}</strong><small>{item.due_date ? `${when(item.due_date)}${item.due_time ? ` at ${item.due_time}` : item.daypart ? ` · ${item.daypart}` : " · Time not set"}` : "No due date"}</small><small>Source: “{item.source_excerpt}”</small>{item.needs_review === 1 && <em>Review timing before accepting</em>}</div><div className="sms-suggestion-actions"><button disabled={busy || (item.needs_review === 1 && item.category === "ADDRESS REVIEW") || (!item.due_date && ["FOLLOW-UP", "APPOINTMENT"].includes(item.category))} onClick={() => decide([item])}>Accept</button><button disabled={busy} onClick={() => { setEditing(item.id); setDraft({ title: item.title, due_date: item.due_date || "", due_time: item.due_time || "", field_value: item.field_value || "" }); }}>Edit</button><button disabled={busy} onClick={() => decide([item], true)}>Dismiss</button></div>{editing === item.id && <div className="sms-edit"><label>Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label>Date<input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} /></label><label>Time<input type="time" value={draft.due_time} onChange={(e) => setDraft({ ...draft, due_time: e.target.value })} /></label>{item.field_name && <label>Value<input value={draft.field_value} onChange={(e) => setDraft({ ...draft, field_value: e.target.value })} /></label>}<button disabled={busy} onClick={() => saveEdit(item)}>Save edit</button></div>}</div>)}<div><button disabled={busy || pending.some((item) => (item.needs_review === 1 && item.category === "ADDRESS REVIEW") || (!item.due_date && ["FOLLOW-UP", "APPOINTMENT"].includes(item.category)))} onClick={() => decide(pending)}>Accept all</button><button disabled={busy} onClick={() => decide(pending, true)}>Dismiss all</button></div></div>}
  </section>;
}

function VoiceMemoModal({ c, close, reload }: { c: Rec; close: () => void; reload: () => Promise<void> }) {
  const recorder = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), recognition = useRef<any>(null), transcriptRef = useRef("");
  const [state, setState] = useState<"ready" | "recording" | "paused" | "saving">("ready"), [seconds, setSeconds] = useState(0), [title, setTitle] = useState(""), [interactionType, setInteractionType] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  useEffect(() => () => {
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recognition.current?.stop?.();
  }, []);
  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      recorder.current = media; chunks.current = []; transcriptRef.current = "";
      media.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const speech = new SpeechRecognition(); speech.continuous = true; speech.interimResults = false;
        speech.lang = "en-US";
        speech.onresult = (event: any) => { for (let index = event.resultIndex; index < event.results.length; index++) if (event.results[index][0]?.transcript) transcriptRef.current += `${event.results[index][0].transcript.trim()} `; };
        speech.onerror = () => undefined; recognition.current = speech; speech.start();
      }
      media.start(1000); setSeconds(0); setState("recording");
    } catch { setError("Microphone access is needed to record a voice memo."); }
  };
  const pause = () => {
    if (state === "recording") { recorder.current?.pause(); recognition.current?.stop?.(); setState("paused"); }
    else { recorder.current?.resume(); recognition.current?.start?.(); setState("recording"); }
  };
  const cancel = () => { recorder.current?.stop(); recorder.current?.stream.getTracks().forEach((track) => track.stop()); recognition.current?.stop?.(); close(); };
  const save = async () => {
    const media = recorder.current; if (!media) return;
    setState("saving"); recognition.current?.stop?.();
    media.onstop = async () => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        const form = new FormData(); form.set("audio", blob, "voice-memo.webm"); form.set("contactId", String(c.id)); form.set("duration", String(seconds)); form.set("title", title); form.set("interactionType", interactionType); form.set("transcript", transcriptRef.current.trim());
        const response = await fetch("/api/voice-memos", { method: "POST", body: form });
        if (!response.ok) throw Error(((await response.json()) as Rec).error || "Voice memo could not be saved.");
        await reload(); close();
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Voice memo could not be saved."); setState("ready"); }
      finally { media.stream.getTracks().forEach((track) => track.stop()); }
    };
    media.stop();
  };
  return <Modal title={`Voice memo for ${c.first_name}`} close={state === "saving" ? () => undefined : close}>
    <div className="voice-recorder">
      {state === "ready" ? <div className="recording-consent"><span><Mic /></span><h3>Ready when you are</h3><p>Record your own recollection after the conversation. Recording will only begin when you press Start.</p><button className="record-start" onClick={start}><Mic /> Start recording</button></div> : <>
        <div className={`recording-live ${state}`}><i /><b>{state === "recording" ? "Recording" : state === "paused" ? "Paused" : "Saving securely…"}</b><strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong></div>
        <div className="record-controls"><button disabled={state === "saving"} onClick={pause}>{state === "paused" ? <Play /> : <Pause />}{state === "paused" ? "Resume" : "Pause"}</button><button disabled={state === "saving"} onClick={cancel}><X /> Cancel</button><button className="primary" disabled={state === "saving" || seconds < 1} onClick={save}><Square /> Save</button></div>
      </>}
      <label>Optional title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Listing Appointment Debrief" /></label>
      <label>Meeting type (optional)<select value={interactionType} onChange={(event) => setInteractionType(event.target.value)}><option value="">In-person follow-up / Voice Memo</option>{["Listing Appointment","Buyer Consultation","Showing","Open House","Client Meeting","Phone Follow-Up Notes","Networking","Other"].map((type) => <option key={type}>{type}</option>)}</select></label>
      {error && <p className="recorder-error">{error}</p>}
    </div>
  </Modal>;
}

function VoiceMemoRecord({ item, suggestions, reload }: { item: Rec; suggestions: Rec[]; reload: () => Promise<void> }) {
  const actionNeedsDate = (suggestion: Rec) => suggestion.category === "ADDRESS REVIEW" || (["TASK", "FOLLOW-UP", "APPOINTMENT"].includes(suggestion.category) && (!suggestion.due_date || suggestion.needs_review === 1));
  const [open, setOpen] = useState(false), [tab, setTab] = useState("Summary"), [selected, setSelected] = useState<number[]>(suggestions.filter((s) => s.status === "Suggested" && !actionNeedsDate(s)).map((s) => s.id)), [busy, setBusy] = useState(false), [retryError, setRetryError] = useState(""), [actionError, setActionError] = useState("");
  const pending = suggestions.filter((suggestion) => suggestion.status === "Suggested");
  const update = async (ids: number[], dismiss = false) => {
    setBusy(true); setActionError("");
    try {
      const response = await fetch(`/api/voice-memos/${item.id}/suggestions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, dismiss }) });
      const result = await response.json() as Rec;
      if (!response.ok) throw Error(result.error || "Those suggestions could not be saved.");
      await reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Those suggestions could not be saved.");
    } finally { setBusy(false); }
  };
  const retryTranscription = async () => { setBusy(true); setRetryError(""); const response = await fetch(`/api/voice-memos/${item.id}/transcribe`, { method: "POST" }); if (!response.ok) setRetryError(((await response.json()) as Rec).error || "Transcription failed."); await reload(); setBusy(false); };
  return <article className={`timeline-record call-record voice-memo-record ${open ? "open" : ""}`}>
    <span className="timeline-type-icon"><Mic /></span><div>
      <button className="call-summary-row" onClick={() => setOpen(!open)} aria-expanded={open}><span><b>{item.subject || "Voice Memo"}</b><small>{item.interaction_type || "In-person follow-up / Voice Memo"}</small></span><span><time>{whenDetailed(item.occurred_at)}</time><small>{duration(item.duration_seconds)} · {item.author_name || "Brad Claus"}</small></span><span className={item.transcription_status === "Transcript ready" ? "recording-ready" : "recording-pending"}>{item.transcription_status || "Processing"}</span><ChevronRight /></button>
      {open && <div className="call-detail"><audio controls preload="none" src={`/api/voice-memos/${item.id}/audio`}>Your browser cannot play this recording.</audio><div className="call-tabs">{["Summary","Transcript","Intelligence"].map((name) => <button className={tab === name ? "active" : ""} key={name} onClick={() => setTab(name)}>{name}</button>)}</div>
        {tab === "Summary" && <div className="call-tab-content">{item.ai_summary ? <p>{item.ai_summary}</p> : <p className="compact-empty">Summary will appear after transcription.</p>}<small className="memo-source">Source: Brad Claus · Voice memo</small></div>}
        {tab === "Transcript" && <div className="call-tab-content"><TranscriptView transcript={item.message_transcript} singleSpeaker />{item.transcription_status === "Transcription failed" && <div className="transcription-failed"><p>The audio is safe, but transcription failed.</p><button disabled={busy} onClick={retryTranscription}>{busy ? "Retrying…" : "Retry transcription"}</button>{retryError && <small>{retryError}</small>}</div>}</div>}
        {tab === "Intelligence" && <div className="call-tab-content"><span className="ai-label">AI Interpretation</span>{actionError && <p className="recorder-error">{actionError}</p>}{pending.length ? <div className="memo-suggestions">{pending.map((suggestion) => { const blocked = actionNeedsDate(suggestion); return <label className={blocked ? "needs-review" : ""} key={suggestion.id}><input type="checkbox" disabled={blocked} checked={selected.includes(suggestion.id)} onChange={() => setSelected((value) => value.includes(suggestion.id) ? value.filter((id) => id !== suggestion.id) : [...value, suggestion.id])} /><span><b>{suggestion.category}{suggestion.commitment === 1 ? " · PROMISED" : ""}</b><strong>{suggestion.title}</strong>{suggestion.due_date && <em>{suggestion.category === "APPOINTMENT" ? when(suggestion.due_date) : `Due ${when(suggestion.due_date)}`} · {suggestion.due_time ? new Date(`2000-01-01T${suggestion.due_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : suggestion.daypart ? `${suggestion.daypart} · Time not set` : "Time not set"}</em>}{blocked && <em>Ambiguous date · review before accepting</em>}{suggestion.source_excerpt && <small>Source: “{suggestion.source_excerpt}”</small>}</span></label>})}<div><button disabled={busy || !selected.length} onClick={() => update(selected)}>Accept selected</button><button disabled={busy || pending.some(actionNeedsDate)} onClick={() => update(pending.map((s) => s.id))}>Accept all</button><button disabled={busy} onClick={() => update([], true)}>Dismiss</button></div></div> : <p className="compact-empty">No pending suggestions.</p>}</div>}
      </div>}
    </div>
  </article>;
}

function TimelineRecord({ c, item, act }: { c: Rec; item: Rec; act: (p: Rec) => Promise<boolean> }) {
  const type = String(item.timelineType), lower = type.toLowerCase();
  const isText = lower.includes("text") || lower.includes("sms");
  const direction = String(item.direction || "").toLowerCase();
  let participants: Rec = {};
  if (typeof item.participants === "string") {
    try { participants = JSON.parse(item.participants); } catch { /* Older records may not have structured participants. */ }
  }
  const icon = lower.includes("text") || lower.includes("sms") ? <MessageSquare />
    : lower.includes("email") ? <Mail />
      : lower.includes("task") || lower.includes("appointment") ? <CheckSquare />
        : lower.includes("transaction") || lower.includes("opportunity") ? <Handshake />
          : <NotebookPen />;
  const contactName = `${c.first_name} ${c.last_name}`;
  const route = participants.sender_name && participants.recipient_name
    ? `${participants.sender_name} → ${participants.recipient_name}`
    : direction === "inbound" || direction === "incoming" ? `${contactName} → Brad Claus`
      : direction === "outbound" || direction === "outgoing" ? `Brad Claus → ${contactName}` : "Sender and recipient unknown";
  const directionLabel = direction === "inbound" || direction === "incoming" ? "Inbound"
    : direction === "outbound" || direction === "outgoing" ? "Outbound" : "Direction unknown";
  return <article className="timeline-record">
    <span className="timeline-type-icon">{icon}</span>
    <div>
      <div className="timeline-record-head"><b>{type}</b>{!isText && <time>{whenDetailed(item.timelineDate)}</time>}</div>
      {isText && <div className="sms-meta"><time>{whenDetailed(item.timelineDate)}</time><span>{directionLabel}</span><span>{route}</span></div>}
      {lower.includes("email") && <p className="timeline-route">{route}</p>}
      {lower.includes("email") && item.subject && <h3>{item.subject}</h3>}
      {lower.includes("email") && Array.isArray(participants.attachments) && participants.attachments.length > 0 && <div className="sms-meta">{participants.attachments.map((file: Rec, index: number) => <span key={index}>Attachment: {file.name} ({file.content_type || "file"})</span>)}</div>}
      {lower.includes("task") || lower.includes("appointment") ? <p>{item.title} · {item.due_date || "Date not set"} · {item.due_time || "Time not set"}</p> : <p>{item.body || item.message_transcript || item.detail || item.title || (isText && participants.body_missing ? "No visible message body" : item.original_imported_text || "Activity recorded")}</p>}
      {item.imported === 1 && <span className="imported-label">Imported from {item.source_system || "FUB"}</span>}
    </div>
  </article>;
}

function CallRecord({ c, item, suggestions, reload }: { c: Rec; item: Rec; suggestions: Rec[]; reload: () => Promise<void> }) {
  const actionNeedsDate = (suggestion: Rec) => suggestion.category === "ADDRESS REVIEW" || (["TASK", "FOLLOW-UP", "APPOINTMENT"].includes(suggestion.category) && (!suggestion.due_date || suggestion.needs_review === 1));
  const pending = suggestions.filter((suggestion) => suggestion.status === "Suggested");
  const [open, setOpen] = useState(false), [tab, setTab] = useState("Summary"), [selectedSuggestions, setSelectedSuggestions] = useState<number[]>(pending.filter((suggestion) => !actionNeedsDate(suggestion)).map((suggestion) => suggestion.id)), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(""), [recordingFailed, setRecordingFailed] = useState(false), [audioAttempt, setAudioAttempt] = useState(0);
  const analysisRequested = useRef(false);
  const incoming = item.direction === "incoming", name = `${c.first_name} ${c.last_name}`;
  useEffect(() => {
    if (!item.message_transcript || item.analysis_status === "Call intelligence v2" || analysisRequested.current) return;
    analysisRequested.current = true;
    fetch(`/api/telnyx/calls/${item.id}/analyze`, { method: "POST" })
      .then(async (response) => { if (!response.ok) throw Error((await response.json() as Rec).error || "Call analysis could not be refreshed."); await reload(); })
      .catch((reason) => setActionError(reason instanceof Error ? reason.message : "Call analysis could not be refreshed."));
  }, [item.id, item.message_transcript, item.analysis_status, reload]);
  const updateSuggestions = async (ids: number[], dismiss = false) => {
    setBusy(true); setActionError("");
    try {
      const response = await fetch(`/api/voice-memos/${item.id}/suggestions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, dismiss }) });
      const result = await response.json() as Rec;
      if (!response.ok) throw Error(result.error || "Those suggestions could not be saved.");
      await reload();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Those suggestions could not be saved."); }
    finally { setBusy(false); }
  };
  const reprocess = async () => {
    setBusy(true); setActionError("");
    try {
      const response = await fetch(`/api/telnyx/calls/${item.id}/analyze`, { method: "POST" });
      if (!response.ok) throw Error((await response.json() as Rec).error || "Call analysis could not be refreshed.");
      setSelectedSuggestions([]);
      await reload();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Call analysis could not be refreshed."); }
    finally { setBusy(false); }
  };
  return <article className={`timeline-record call-record ${open ? "open" : ""}`}>
    <span className="timeline-type-icon"><Phone /></span>
    <div>
      <button className="call-summary-row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span><b>{incoming ? "Incoming" : "Outgoing"} call</b><small>{name}</small></span>
        <span><time>{whenDetailed(item.occurred_at)}</time><small>{duration(item.duration_seconds)} · {item.status || "Completed"}</small></span>
        <span className={item.recording_id ? "recording-ready" : "recording-pending"}>{item.recording_id ? "Recording saved" : "No recording"}</span>
        <ChevronRight />
      </button>
      {open && <div className="call-detail">
        <div className="call-detail-actions">
          {(item.audio_object_key || item.recording_url) && !recordingFailed && <audio key={audioAttempt} controls preload="metadata" src={`/api/telnyx/recordings/${item.id}?attempt=${audioAttempt}`} onError={() => setRecordingFailed(true)}>Your browser cannot play this recording.</audio>}
          {item.recording_id && !item.audio_object_key && !item.recording_url && <p className="recording-state">Recording processing…</p>}
          {recordingFailed && <div className="recording-unavailable"><span>Recording unavailable</span><button onClick={() => { setRecordingFailed(false); setAudioAttempt((value) => value + 1); }}>Retry</button></div>}
        </div>
        <div className="call-tabs">
          {["Summary", "Transcript", "Intelligence"].map((name) => <button className={tab === name ? "active" : ""} key={name} onClick={() => setTab(name)}>{name}</button>)}
        </div>
        {tab === "Summary" && <div className="call-tab-content">
          {item.ai_summary ? <p>{item.ai_summary}</p> : <p className="compact-empty">Summary not generated yet.</p>}
          {item.follow_up_suggestion && <CompactField label="Follow-up needed" value={item.follow_up_suggestion} />}
          {item.call_outcome && <CompactField label="Outcome" value={item.call_outcome} />}
        </div>}
        {tab === "Transcript" && <div className="call-tab-content"><CallTranscriptView item={item} /></div>}
        {tab === "Intelligence" && <div className="call-tab-content"><span className="ai-label">AI Interpretation</span><button disabled={busy || !item.message_transcript} onClick={reprocess}>{busy ? "Reprocessing…" : "Reprocess call"}</button>{actionError && <p className="recorder-error">{actionError}</p>}{pending.length ? <div className="memo-suggestions">{pending.map((suggestion) => { const blocked = actionNeedsDate(suggestion); return <label className={blocked ? "needs-review" : ""} key={suggestion.id}><input type="checkbox" disabled={blocked} checked={selectedSuggestions.includes(suggestion.id)} onChange={() => setSelectedSuggestions((value) => value.includes(suggestion.id) ? value.filter((id) => id !== suggestion.id) : [...value, suggestion.id])} /><span><b>{suggestion.category}{suggestion.commitment === 1 ? " · PROMISED" : ""}</b><strong>{suggestion.title}</strong>{suggestion.due_date && <em>{suggestion.category === "APPOINTMENT" ? when(suggestion.due_date) : `Due ${when(suggestion.due_date)}`} · {suggestion.due_time ? new Date(`2000-01-01T${suggestion.due_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : suggestion.daypart ? `${suggestion.daypart} · Time not set` : "Time not set"}</em>}{blocked && <em>Ambiguous date · review before accepting</em>}{suggestion.source_excerpt && <small>Source: “{suggestion.source_excerpt}”</small>}</span></label>})}<div><button disabled={busy || !selectedSuggestions.length} onClick={() => updateSuggestions(selectedSuggestions)}>Accept selected</button><button disabled={busy || pending.some(actionNeedsDate)} onClick={() => updateSuggestions(pending.map((suggestion) => suggestion.id))}>Accept all</button><button disabled={busy} onClick={() => updateSuggestions([], true)}>Dismiss</button></div></div> : item.analysis_status === "Processing" ? <p className="compact-empty">Analyzing this call…</p> : <p className="compact-empty">No pending suggestions.</p>}</div>}
      </div>}
    </div>
  </article>;
}

function CallTranscriptView({ item }: { item: Rec }) {
  let utterances: Rec[] = [];
  try { const parsed = JSON.parse(item.participants || "[]"); if (Array.isArray(parsed)) utterances = parsed; } catch { /* old calls fall back below */ }
  if (!utterances.length) return <TranscriptView transcript={item.message_transcript} />;
  const callTime = validDate(item.occurred_at) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(storedDateTime(item.occurred_at)) : "";
  return <div className="transcript-lines call-utterances">{utterances.map((utterance, index) => <div key={`${index}-${utterance.channel || "speaker"}`}><span><b>{utterance.speaker || utterance.channel}</b>{callTime && <time>{callTime}</time>}</span><p>{utterance.text}</p></div>)}</div>;
}

function TranscriptView({ transcript, singleSpeaker = false }: { transcript?: string; singleSpeaker?: boolean }) {
  if (!transcript) return <p className="compact-empty">Transcript not available yet.</p>;
  const lines = transcript.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return <div className="transcript-lines">{lines.map((line, index) => {
    const labeled = line.match(/^([^:]{1,40}):\s*(.+)$/);
    return <div key={`${index}-${line.slice(0, 12)}`}><b>{labeled ? labeled[1] : singleSpeaker ? "Brad Claus" : `Speaker ${index % 2 + 1}`}</b><p>{labeled ? labeled[2] : line}</p></div>;
  })}</div>;
}

function SidebarSection({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <details className="sidebar-section" open={open}><summary>{title}<ChevronRight /></summary><div>{children}</div></details>;
}

function CompactField({ label, value, accent = false }: { label: string; value?: string; accent?: boolean }) {
  if (!value) return null;
  return <div className={accent ? "compact-field accent" : "compact-field"}><small>{label}</small><p>{value}</p></div>;
}
function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "field accent" : "field"}>
      <small>{label}</small>
      <p>{value || "Not recorded yet"}</p>
    </div>
  );
}
function Avatar({ c }: { c?: Rec }) {
  return (
    <span className="avatar contact-avatar">
      {c ? (c.first_name?.[0] || "") + (c.last_name?.[0] || "") : "?"}
    </span>
  );
}
function Badge({ children }: { children: any }) {
  return <span className="badge">{children}</span>;
}
function Temp({ t }: { t: string }) {
  return (
    <span className={"temp " + (t || "").toLowerCase()}>
      {t === "Hot" && <Flame />}
      {t}
    </span>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: any;
}) {
  return (
    <div className="modal-wrap">
      <button className="modal-scrim" onClick={close} />
      <section className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function EmailModal({c,close,reload}: {c:Rec;close:()=>void;reload:()=>Promise<void>}) {
  const addresses = [...new Set([c.email,...String(c.additional_emails||"").split(/\r?\n/).map(value=>value.split("|")[0])].map(value=>String(value||"").trim()).filter(Boolean))];
  const [to,setTo]=useState(addresses[0]||""),[subject,setSubject]=useState(""),[body,setBody]=useState(""),[status,setStatus]=useState<Rec|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false);
  useEffect(()=>{fetch("/api/microsoft/status").then(r=>r.json() as Promise<Rec>).then(setStatus).catch(()=>setError("Could not check your Microsoft 365 connection."))},[]);
  const reconnect=async()=>{setBusy(true);setError("");try {const response=await fetch("/api/microsoft/connect",{method:"POST"});const result=await response.json() as Rec;if(!response.ok)throw Error(result.error||"Could not start Microsoft sign-in.");window.location.assign(result.url)}catch(reason){setError(reason instanceof Error?reason.message:"Could not start Microsoft sign-in.");setBusy(false)}};
  const send=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try {const response=await fetch("/api/microsoft/send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contactId:c.id,to,subject,body})});const result=await response.json() as Rec;if(!response.ok)throw Error(result.error||"Email could not be sent.");setSent(true);await reload()}catch(reason){setError(reason instanceof Error?reason.message:"Email could not be sent.")}finally{setBusy(false)}};
  return <Modal title={`Email ${c.display_name||`${c.first_name} ${c.last_name}`}`} close={close}>
    {sent ? <div role="status"><p>Microsoft 365 accepted your email. It will appear in this contact’s email history when Sent Items sync completes.</p><div className="form-actions"><button className="primary" onClick={close}>Done</button></div></div> : status?.ownedByAnotherAccount ? <p>Sign in with the account that connected this mailbox to send email.</p> : !status ? <p>Checking Microsoft 365 connection…</p> : !status.connected || !status.canSend ? <div><p>{status.connected ? "Your mailbox is connected for reading. Approve Microsoft’s Mail.Send permission once to send from your connected mailbox." : "Connect Microsoft 365 to send from your connected mailbox."}</p><button className="primary" disabled={busy} onClick={reconnect}>{busy?"Opening Microsoft…":status.connected?"Approve sending permission":"Connect Microsoft 365"}</button></div> : addresses.length===0 ? <p>This contact has no email address. Close this window and use Edit contact to add one.</p> : <form onSubmit={send}>
      <p>From: <b>{status.mailbox}</b></p>
      <label>To<select value={to} onChange={e=>setTo(e.target.value)}>{addresses.map(address=><option key={address}>{address}</option>)}</select></label>
      <label>Subject<input required maxLength={998} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
      <label>Message<textarea required className="email-compose-body" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your email…"/></label>
      <div className="form-actions"><button type="button" className="ghost" onClick={close} disabled={busy}>Cancel</button><button className="primary" type="submit" disabled={busy||!to}>{busy?"Sending…":"Send email"}</button></div>
    </form>}
    {error && <p className="call-feedback error" role="alert">{error}</p>}
  </Modal>;
}

function RecordModal({kind,c,existing,close,act}: {kind:"contact"|"appointment"|"transaction"|"task";c:Rec;existing?:Rec;close:()=>void;act:(p:Rec)=>Promise<boolean>}) {
  const details = (() => {try {return JSON.parse(existing?.details || "{}")} catch {return {}}})();
  const [f,setF] = useState<Rec>(kind === "contact" ? {...c,...splitContactAddress(c.address),originalAddress:c.address} : kind === "appointment" || kind === "task" ? {contactId:c.id,id:existing?.id,title:existing?.title||"",dueDate:existing?.due_date||today(),dueTime:existing?.due_time||"",status:existing?.status||"Scheduled",notes:existing?.notes||"",precision:existing?.due_time?"exact":"date only",...details} : {contactId:c.id,id:existing?.id,type:existing?.type||"Seller",stage:existing?.stage||"Opportunity",propertyAddress:existing?.property_address||"",notes:existing?.notes||"",...details});
  const [busy,setBusy] = useState(false);
  const field = (key:string,label:string,type="text",required=false) => <label key={key}>{label}<input type={type} required={required} value={f[key] ?? ""} onChange={e=>setF(prev=>({...prev,[key]:e.target.value,...(key.startsWith("address") ? {addressEdited:true} : {})}))}/></label>;
  const choice = (key:string,label:string,options:string[]) => <label key={key}>{label}<select value={f[key]||options[0]} onChange={e=>setF(prev=>({...prev,[key]:e.target.value,...(key.startsWith("address") ? {addressEdited:true} : {})}))}>{options.map(o=><option key={o}>{o}</option>)}</select></label>;
  const contactFields = [field("first_name","First name","text",true),field("last_name","Last name","text",true),field("display_name","Display name"),field("phone","Primary phone","tel"),choice("phone_type","Phone type",["Mobile","Home","Work","Other"]),<label key="additional_phones">Additional phones (number | type, one per line)<textarea value={f.additional_phones||""} onChange={e=>setF(prev=>({...prev,additional_phones:e.target.value}))}/></label>,field("email","Primary email","email"),choice("email_type","Email type",["Personal","Work","Other"]),<label key="additional_emails">Additional emails (email | type, one per line)<textarea value={f.additional_emails||""} onChange={e=>setF(prev=>({...prev,additional_emails:e.target.value}))}/></label>,field("addressStreet","Contact address · street"),field("addressCity","City"),field("addressState","State"),field("addressZip","ZIP code"),field("addressCountry","Country (optional)"),field("property_address","Seller property address"),choice("relationship","Relationship",[...relationshipOptions]),choice("intent","Intent",[...intentOptions]),choice("stage","Stage",[...stageOptions]),field("lead_source","Lead source"),choice("temperature","Temperature",["Hot","Warm","Cool"]),field("tags","Tags (comma separated)"),field("birthday","Birthday","date"),field("spouse_name","Spouse / partner"),field("contextual_notes","Contact notes")];
  const appointmentFields = [field("title","Title / purpose","text",true),field("dueDate","Date","date",true),choice("precision","Scheduling precision",["exact","date only","daypart","flexible"]),...(f.precision === "exact" ? [field("dueTime","Time","time"),field("endTime","End time (optional)","time")] : []),...(f.precision === "daypart" ? [choice("daypart","Daypart",["Morning","Afternoon","Evening"])] : []),field("location","Location"),field("propertyAddress","Property address"),field("reminder","Reminder"),choice("status","Status",["Scheduled","Completed","Cancelled","No-show"]),<label key="inviteContact"><input type="checkbox" checked={!!f.inviteContact} onChange={e=>setF(prev=>({...prev,inviteContact:e.target.checked}))}/> Invite contact by Outlook email</label>,<label key="commitment"><input type="checkbox" checked={!!f.commitment} onChange={e=>setF(prev=>({...prev,commitment:e.target.checked}))}/> Commitment</label>,field("notes","Notes")];
  const stages = f.type === "Buyer" ? ["Opportunity","Appointment Set","Showing","Offer Written","Offer Accepted","Under Contract - Option Period","Under Contract - Post-Option","Pending","Closed"] : ["Opportunity","Appointment Set","Listing Active","Listing - Price Reduced","Under Contract - Option Period","Under Contract - Post-Option","Pending","Closed"];
  const commonTransaction = [choice("type","Transaction type",["Seller","Buyer"]),field("propertyAddress","Property address"),choice("stage","Transaction stage",stages),field("assignedAgent","Assigned agent"),field("createdDate","Created date","date"),field("mlsNumber","MLS number"),field("bedrooms","Bedrooms","number"),field("bathrooms","Bathrooms","number"),field("squareFootage","Square footage","number"),field("closingDate","Closing date","date"),field("commission","Commission","number")];
  const sellerFields = [field("listPrice","List price","number"),field("currentPrice","Current price","number"),field("listingDate","Listing date","date"),field("lotSize","Lot size"),field("yearBuilt","Year built","number"),field("mortgageBalance","Mortgage balance / equity","number"),field("sellerPriceExpectation","Seller price expectation","number"),field("expectedNetProceeds","Expected net proceeds","number")];
  const buyerFields = [field("offerPrice","Offer price","number"),field("contractPrice","Contract price","number"),field("purchasePrice","Purchase price","number"),field("earnestMoney","Earnest money","number"),field("optionFee","Option fee","number"),field("financingType","Financing type"),field("lender","Lender"),field("preApprovalAmount","Pre-approval amount","number")];
  return <Modal title={kind === "contact" ? "Edit contact" : `${existing ? "Edit" : "Add"} ${kind}`} close={close}><form onSubmit={async e=>{e.preventDefault();setBusy(true);const ok=await act({action:kind === "contact" ? "editContact" : kind === "appointment" ? "saveAppointment" : kind === "task" ? "saveTask" : "saveTransaction",...f,contactId:c.id});if(!ok)setBusy(false)}}>
    {kind === "appointment" && existing && <p role="status">Calendar sync: {({synced:"Synced to Outlook",pending:"Sync pending",waiting_for_time:"Waiting for time",failed:"Sync failed",not_synced:"Not synced"} as Record<string,string>)[existing.calendar_sync_status] || (existing.due_time ? "Not synced" : "Waiting for time")}{existing.calendar_sync_error ? ` · ${existing.calendar_sync_error}` : ""}</p>}
    <div className="form-grid">{kind === "contact" ? contactFields : kind === "appointment" || kind === "task" ? appointmentFields : [...commonTransaction,...(f.type === "Buyer" ? buyerFields : sellerFields),field("notes","Notes")]}</div>
    <div className="form-actions"><button type="button" className="ghost" onClick={close}>Cancel</button><button className="primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save changes"}</button></div>
  </form></Modal>;
}

function ContactModal({
  close,
  act,
}: {
  close: () => void;
  act: (p: Rec) => Promise<boolean>;
}) {
  const [f, setF] = useState<Rec>({
      relationship: "Lead",
      intent: "None / Unknown",
      stage: "Lead",
      temperature: "Warm",
    }),
    set = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <Modal title="Add contact" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: "addContact", ...f });
        }}
      >
        <div className="form-grid">
          <label>
            First name
            <input
              required
              onChange={(e) => set("firstName", e.target.value)}
            />
          </label>
          <label>
            Last name
            <input required onChange={(e) => set("lastName", e.target.value)} />
          </label>
          <label>
            Phone
            <input onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label>
            Email
            <input
              type="email"
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label>Contact address · street<input onChange={(e) => set("addressStreet",e.target.value)} /></label>
          <label>City<input onChange={(e) => set("addressCity",e.target.value)} /></label>
          <label>State<input onChange={(e) => set("addressState",e.target.value)} /></label>
          <label>ZIP code<input onChange={(e) => set("addressZip",e.target.value)} /></label>
          <label>Country (optional)<input onChange={(e) => set("addressCountry",e.target.value)} /></label>
          <label>
            Relationship
            <select onChange={(e) => set("relationship", e.target.value)}>
              {relationshipOptions.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Intent
            <select onChange={(e) => set("intent", e.target.value)}>
              {intentOptions.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>Stage<select onChange={(e) => set("stage", e.target.value)}>{Object.entries(stageGroups).map(([group, values]) => <optgroup key={group} label={group}>{values.map((value) => <option key={value}>{value}</option>)}</optgroup>)}</select></label>
          <label>
            Lead source
            <input onChange={(e) => set("leadSource", e.target.value)} />
          </label>
          <label>
            Next follow-up
            <input
              type="date"
              onChange={(e) => set("nextFollowUp", e.target.value)}
            />
          </label>
        </div>
        <label>
          Recommended next action
          <textarea
            onChange={(e) => set("recommendedNextAction", e.target.value)}
          />
        </label>
        <FormActions close={close} />
      </form>
    </Modal>
  );
}
function NoteModal({
  c,
  close,
  act,
}: {
  c: Rec;
  close: () => void;
  act: (p: Rec) => Promise<boolean>;
}) {
  const [body, setBody] = useState("");
  return (
    <Modal title={`Add note for ${c.first_name}`} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: "addNote", contactId: c.id, body });
        }}
      >
        <label>
          What happened?
          <textarea
            autoFocus
            required
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Capture what you discussed, what matters, and what should happen next."
          />
        </label>
        <FormActions close={close} />
      </form>
    </Modal>
  );
}
function TaskModal({
  c,
  close,
  act,
}: {
  c: Rec;
  close: () => void;
  act: (p: Rec) => Promise<boolean>;
}) {
  const [f, setF] = useState<Rec>({
      type: "Follow-up",
      priority: "Normal",
      dueDate: today(),
    }),
    set = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <Modal title={`Add task for ${c.first_name}`} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: "addTask", contactId: c.id, ...f });
        }}
      >
        <label>
          Task
          <input
            autoFocus
            required
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Type
            <select onChange={(e) => set("type", e.target.value)}>
              <option>Follow-up</option>
              <option>Task</option>
              <option>Appointment</option>
            </select>
          </label>
          <label>
            Priority
            <select onChange={(e) => set("priority", e.target.value)}>
              <option>Normal</option>
              <option>High</option>
              <option>Low</option>
            </select>
          </label>
          <label>
            Due date
            <input
              type="date"
              required
              value={f.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </label>
          <label>
            Due time
            <input
              type="time"
              onChange={(e) => set("dueTime", e.target.value)}
            />
          </label>
        </div>
        <label>
          Why / notes
          <textarea onChange={(e) => set("notes", e.target.value)} />
        </label>
        <FormActions close={close} />
      </form>
    </Modal>
  );
}
function FormActions({ close }: { close: () => void }) {
  return (
    <div className="form-actions">
      <button type="button" className="ghost" onClick={close}>
        Cancel
      </button>
      <button className="primary">Save</button>
    </div>
  );
}
