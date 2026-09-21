"use client";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
type Rec = Record<string, any>;
type Data = {
  contacts: Rec[];
  opportunities: Rec[];
  tasks: Rec[];
  notes: Rec[];
  communications: Rec[];
  properties: Rec[];
  activities: Rec[];
};
const empty: Data = {
  contacts: [],
  opportunities: [],
  tasks: [],
  notes: [],
  communications: [],
  properties: [],
  activities: [],
};
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Contacts", Users],
  ["Opportunities", Handshake],
  ["Tasks", CheckSquare],
  ["Communications", MessagesSquare],
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
const when = (s?: string) =>
  s
    ? new Date(
        s.replace(" ", "T") + (s.includes("T") ? "" : "Z"),
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
export default function Home() {
  const [data, setData] = useState<Data>(empty),
    [view, setView] = useState("Dashboard"),
    [selected, setSelected] = useState<Rec | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(""),
    [mobile, setMobile] = useState(false);
  async function load() {
    try {
      const r = await fetch("/api/crm");
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
    load();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    return () => window.clearInterval(refresh);
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
    <div className="app-shell">
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
            </div>
          )}
          {loading ? (
            <Loading />
          ) : selected ? (
            <ContactPage
              c={selected}
              data={data}
              act={act}
              modal={modal}
              setModal={setModal}
              back={() => setSelected(null)}
            />
          ) : view === "Dashboard" ? (
            <Dashboard
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
          ) : (
            <SettingsPage />
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
  return (
    <section className="panel table-panel">
      <PanelHead
        title="People, not records"
        sub={`${contacts.length} contacts · Sorted by relationship priority`}
      />
      <div className="contact-table">
        <div className="tr th">
          <span>Contact</span>
          <span>Relationship</span>
          <span>Intent</span>
          <span>Temperature</span>
          <span>Next follow-up</span>
          <span />
        </div>
        {contacts.map((c) => (
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
function SettingsPage() {
  return (
    <section className="settings-grid">
      <article className="panel">
        <h2>Workspace</h2>
        <label>
          CRM name
          <input value="Claus CRM" readOnly />
        </label>
        <label>
          Owner
          <input value="Brad Claus" readOnly />
        </label>
        <label>
          Primary market
          <input value="Schertz · Cibolo · New Braunfels" readOnly />
        </label>
      </article>
      <article className="panel">
        <h2>Future connections</h2>
        {[
          "Twilio calling & SMS",
          "Email provider",
          "Lead sources & website forms",
          "AI relationship intelligence",
        ].map((x) => (
          <div className="future" key={x}>
            <span>{x}</span>
            <Badge>Not connected</Badge>
          </div>
        ))}
      </article>
    </section>
  );
}
function ContactPage({
  c,
  data,
  act,
  modal,
  setModal,
  back,
}: {
  c: Rec;
  data: Data;
  act: (p: Rec) => Promise<boolean>;
  modal: string;
  setModal: (s: string) => void;
  back: () => void;
}) {
  const [tab, setTab] = useState("Overview"),
    [callState, setCallState] = useState(""),
    [callError, setCallError] = useState(""),
    [callCommunicationId, setCallCommunicationId] = useState<number | null>(
      null,
    ),
    notes = data.notes.filter((n) => n.contact_id === c.id),
    tasks = data.tasks.filter((t) => t.contact_id === c.id),
    opps = data.opportunities.filter((o) => o.contact_id === c.id),
    acts = data.activities.filter((a) => a.contact_id === c.id),
    comms = data.communications.filter((item) => item.contact_id === c.id);
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
                {c.first_name} {c.last_name}
              </h2>
              {c.is_sample === 1 && <em>SAMPLE DATA</em>}
            </div>
            <p>
              {c.phone} · {c.email}
            </p>
            <span>
              {(c.tags || "").split(",").map((x: string) => (
                <Badge key={x}>{x}</Badge>
              ))}
            </span>
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
          {[
            [MessageSquare, "Text"],
            [Mail, "Email"],
          ].map(([I, n]: any) => (
            <button title="Placeholder — integration comes later" key={n}>
              <I />
              {n}
            </button>
          ))}
          <button onClick={() => setModal("note")}>
            <NotebookPen />
            Add note
          </button>
          <button className="primary" onClick={() => setModal("task")}>
            <Plus />
            Add task
          </button>
        </div>
      </section>
      {(activeCallStatus || callError) && (
        <div className={callError ? "call-feedback error" : "call-feedback"}>
          <Phone /> {callError || activeCallStatus}
        </div>
      )}
      <section className="contact-facts">
        {[
          ["Relationship", c.relationship],
          ["Lead source", c.lead_source],
          ["Intent", c.intent],
          ["Temperature", c.temperature],
          ["Last contact", when(c.last_meaningful_contact)],
          ["Next follow-up", when(c.next_follow_up)],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <b>{v || "—"}</b>
          </div>
        ))}
      </section>
      <div className="tabs">
        {[
          "Overview",
          "Timeline",
          "Notes",
          "Tasks",
          "Opportunities",
          "Properties",
          "Communications",
        ].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <div className="detail-grid">
          <section className="panel">
            <h3>Relationship intelligence</h3>
            <Field
              label="Relationship summary"
              value={c.relationship_summary}
            />
            <Field label="Motivation" value={c.motivation} />
            <Field label="Concerns" value={c.concerns} />
            <Field
              label="Recommended next action"
              value={c.recommended_next_action}
              accent
            />
          </section>
          <section className="panel">
            <h3>Real estate needs</h3>
            <Field label="Desired property" value={c.desired_property} />
            <Field label="Financing" value={c.financing_type} />
            <Field label="Target locations" value={c.target_locations} />
            <Field label="Property address" value={c.property_address} />
            <Field label="Estimated timeline" value={c.estimated_timeline} />
          </section>
        </div>
      )}
      {tab === "Timeline" && (
        <section className="panel timeline">
          {acts.map((a) => (
            <div key={a.id}>
              <span>
                <NotebookPen />
              </span>
              <article>
                <small>{when(a.occurred_at)}</small>
                <b>{a.title}</b>
                <p>{a.detail}</p>
              </article>
            </div>
          ))}
        </section>
      )}
      {tab === "Notes" && (
        <section className="panel note-list">
          {notes.map((n) => (
            <article key={n.id}>
              <small>{when(n.created_at)}</small>
              <p>{n.body}</p>
            </article>
          ))}
        </section>
      )}
      {tab === "Tasks" && (
        <Tasks data={{ ...data, tasks }} act={act} open={() => {}} />
      )}
      {tab === "Opportunities" && (
        <section className="panel note-list">
          {opps.map((o) => (
            <article key={o.id}>
              <small>
                {o.type} · {o.stage}
              </small>
              <h3>{money(o.estimated_price)} opportunity</h3>
              <p>{o.notes}</p>
            </article>
          ))}
        </section>
      )}
      {tab === "Properties" && (
        <section className="panel empty-state">
          <h2>Properties</h2>
          <p>Property relationships will appear here as they are added.</p>
        </section>
      )}
      {tab === "Communications" && (
        <section className="panel note-list">
          {comms.length === 0 ? (
            <p>No calls or messages for this contact yet.</p>
          ) : (
            comms.map((item) => (
              <article key={item.id}>
                <small>
                  {when(item.occurred_at)} · {item.direction}
                </small>
                <h3>{item.status || "Call"}</h3>
                <p>
                  {item.caller_number || item.from_number} →{" "}
                  {item.destination_number || item.to_number}
                </p>
                <p>
                  {item.duration_seconds
                    ? `${item.duration_seconds}s`
                    : "Duration pending"}{" "}
                  ·{" "}
                  <span className="recording-safe">
                    {item.recording_id
                      ? "Recording saved"
                      : "Recording pending"}
                  </span>
                </p>
              </article>
            ))
          )}
        </section>
      )}
      {modal === "note" && (
        <NoteModal c={c} close={() => setModal("")} act={act} />
      )}{" "}
      {modal === "task" && (
        <TaskModal c={c} close={() => setModal("")} act={act} />
      )}
    </>
  );
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
function ContactModal({
  close,
  act,
}: {
  close: () => void;
  act: (p: Rec) => Promise<boolean>;
}) {
  const [f, setF] = useState<Rec>({
      relationship: "Lead",
      intent: "Unknown",
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
          <label>
            Relationship
            <select onChange={(e) => set("relationship", e.target.value)}>
              {[
                "Lead",
                "Past client",
                "Current client",
                "Sphere",
                "Referral",
                "Vendor",
                "Other",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Intent
            <select onChange={(e) => set("intent", e.target.value)}>
              {[
                "Unknown",
                "Buyer",
                "Seller",
                "Buyer and Seller",
                "Investor",
                "Renter",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
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
            placeholder="Call to discuss timing"
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
