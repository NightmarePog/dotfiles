import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import GLib from "gi://GLib?version=2.0"

const V = Gtk.Orientation.VERTICAL
const H = Gtk.Orientation.HORIZONTAL

const HOME = GLib.get_home_dir()!
const GH_TOKEN_FILE = `${HOME}/.config/ags/github_token`
const GH_USER = "NightmarePog"

interface StatsData {
    cpu: number; ram: number; ram_used: string; ram_total: string
    gpu: number; gpu_temp: number; cpu_temp: number; gpu_mhz: number
}
interface PR     { number: number; title: string; repository_url: string }
interface Commit { repo: string; message: string; relTime: string }

const EMPTY_STATS: StatsData = {
    cpu: 0, ram: 0, ram_used: "0G", ram_total: "0G",
    gpu: 0, gpu_temp: 0, cpu_temp: 0, gpu_mhz: 0,
}
const MAX_PRS     = 5
const MAX_COMMITS = 6

async function ghToken(): Promise<string> {
    try { return (await execAsync(["cat", GH_TOKEN_FILE])).trim() }
    catch { return "" }
}

// ── Clock ──────────────────────────────────────────────────────────────────

function Clock() {
    const time = createPoll("--:--:--", 1000, "date '+%H:%M:%S'")
    const date = createPoll("...", 60000, "date '+%A · %d %B %Y'")
    return (
        <box orientation={V} class="clock-section" halign={Gtk.Align.CENTER}>
            <label class="clock-time" label={time} />
            <label class="clock-date" label={date} />
        </box>
    )
}

// ── Calendar ───────────────────────────────────────────────────────────────

function CalendarWidget() {
    const cal = new Gtk.Calendar({ cssName: "dashboard-calendar", showDayNames: true, showHeading: true })

    const markMonthEvents = async () => {
        cal.clearMarks()
        try {
            const out = await execAsync(["gcalcli", "agenda", "--nocolor", "--tsv", "--military", "--days", "40"])
            const year = cal.year; const month = cal.month + 1
            for (const line of out.split("\n")) {
                const p = line.split("\t")
                if (p.length < 2 || p[0] === "start_date") continue
                const [y, m, d] = p[0].split("-").map(Number)
                if (y === year && m === month) cal.markDay(d)
            }
        } catch { /* gcalcli unavailable */ }
    }

    // Day events panel — built imperatively so we can update children
    const dayTitle = new Gtk.Label({ cssClasses: ["day-events-title"], halign: Gtk.Align.START })
    const dayList  = new Gtk.Box({ orientation: V, spacing: 2 })

    const showDayEvents = async () => {
        const y = cal.year, mo = cal.month + 1, d = cal.day
        if (!d) return
        const date = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`
        const nextDate = (() => {
            const nd = new Date(`${date}T12:00:00`); nd.setDate(nd.getDate() + 1)
            return nd.toISOString().slice(0, 10)
        })()
        dayTitle.label = date

        // Clear day list
        let ch = dayList.get_first_child()
        while (ch) { const nx = ch.get_next_sibling(); dayList.remove(ch); ch = nx }

        try {
            const out = await execAsync(["gcalcli", "agenda", "--nocolor", "--tsv", "--military", date, nextDate])
            const lines = out.split("\n").filter(l => l && !l.startsWith("start_date"))
            if (lines.length === 0) {
                const lbl = new Gtk.Label({ label: "no events", cssClasses: ["day-event-empty"], halign: Gtk.Align.CENTER })
                dayList.append(lbl)
            } else {
                for (const line of lines.slice(0, 6)) {
                    const p = line.split("\t")
                    if (p.length < 5) continue
                    const time = p[1] || "all day"
                    const title = p[4] || ""
                    const row = new Gtk.Box({ orientation: H, spacing: 8 })
                    row.cssClasses = ["day-event-row"]
                    const tl = new Gtk.Label({ label: time, cssClasses: ["day-event-time"], xalign: 0 })
                    const nl = new Gtk.Label({ label: title, cssClasses: ["day-event-name"], halign: Gtk.Align.START, xalign: 0, maxWidthChars: 24, ellipsize: 3, hexpand: true })
                    row.append(tl); row.append(nl)
                    dayList.append(row)
                }
            }
        } catch {
            const lbl = new Gtk.Label({ label: "gcalcli unavailable", cssClasses: ["day-event-empty"], halign: Gtk.Align.CENTER })
            dayList.append(lbl)
        }
    }

    const addBtn = new Gtk.Button({ cssClasses: ["add-event-btn"], halign: Gtk.Align.START })
    addBtn.label = "+ add event"
    addBtn.connect("clicked", () => {
        const y = cal.year, mo = cal.month + 1, d = cal.day
        if (!d) return
        const date = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`
        execAsync(["kitty", "--", "gcalcli", "add", `--when=${date} 09:00`]).catch(() =>
            execAsync(["kitty", "-e", "sh", "-c", `gcalcli add --when="${date} 09:00"; read`]).catch(() => {})
        )
    })

    markMonthEvents()
    cal.connect("prev-month", markMonthEvents)
    cal.connect("next-month", markMonthEvents)
    cal.connect("prev-year",  markMonthEvents)
    cal.connect("next-year",  markMonthEvents)
    cal.connect("day-selected", showDayEvents)

    return (
        <box orientation={V} class="calendar-section">
            <label class="section-title" label="// CALENDAR" halign={Gtk.Align.START} />
            {cal}
            <box orientation={V} class="day-events-panel" spacing={3}>
                {dayTitle}
                {dayList}
                {addBtn}
            </box>
        </box>
    )
}

// ── Stats ──────────────────────────────────────────────────────────────────

function StatRow(props: {
    icon: string; label: string
    fraction: import("gnim").Accessor<number>
    detail: import("gnim").Accessor<string>
    barCssName: string
}) {
    return (
        <box orientation={V} class="stat-row">
            <box orientation={H} class="stat-header">
                <label class="stat-label" label={`${props.icon}  ${props.label}`} hexpand halign={Gtk.Align.START} />
                <label class="stat-detail" label={props.detail} />
            </box>
            <Gtk.ProgressBar cssName={props.barCssName} fraction={props.fraction} />
        </box>
    )
}

function Stats() {
    const stats = createPoll<StatsData>(EMPTY_STATS, 2000, async () => {
        try { return JSON.parse(await execAsync([`${HOME}/.config/ags/scripts/stats.sh`])) as StatsData }
        catch { return EMPTY_STATS }
    })
    return (
        <box orientation={V} class="stats-section">
            <label class="section-title" label="// SYSTEM" halign={Gtk.Align.START} />
            <StatRow icon="" label="CPU"
                fraction={stats(s => Math.min(1, s.cpu / 100))}
                detail={stats(s => `${s.cpu}%  ·  ${s.cpu_temp}°C`)}
                barCssName="stat-bar-cpu" />
            <StatRow icon="" label="RAM"
                fraction={stats(s => Math.min(1, s.ram / 100))}
                detail={stats(s => `${s.ram_used} / ${s.ram_total}`)}
                barCssName="stat-bar-ram" />
            <StatRow icon="󰊵" label="GPU"
                fraction={stats(s => Math.min(1, s.gpu / 100))}
                detail={stats(s => `${s.gpu}%  ·  ${s.gpu_temp}°C  ·  ${s.gpu_mhz}MHz`)}
                barCssName="stat-bar-gpu" />
        </box>
    )
}

// ── GitHub PRs ─────────────────────────────────────────────────────────────

async function fetchPRs(): Promise<PR[]> {
    try {
        const token = await ghToken()
        if (!token) return []
        const out = await execAsync(["curl", "-sf",
            "-H", `Authorization: Bearer ${token}`,
            "-H", "Accept: application/vnd.github+json",
            `https://api.github.com/search/issues?q=is:pr+is:open+involves:${GH_USER}&per_page=8`,
        ])
        return (JSON.parse(out) as { items?: PR[] }).items ?? []
    } catch { return [] }
}

function GitHub() {
    const prs = createPoll<PR[]>([], 300000, fetchPRs)
    return (
        <box orientation={V} class="github-section">
            <label class="section-title" label="// PULL REQUESTS" halign={Gtk.Align.START} />
            <label class="pr-empty" label="no open review requests"
                halign={Gtk.Align.CENTER} visible={prs(l => l.length === 0)} />
            <box orientation={V} spacing={4} visible={prs(l => l.length > 0)}>
                {Array.from({ length: MAX_PRS }, (_, i) => (
                    <box orientation={V} class="pr-item" visible={prs(l => i < l.length)}>
                        <label class="pr-title"
                            label={prs(l => l[i]?.title ?? "")}
                            maxWidthChars={36} ellipsize={3}
                            halign={Gtk.Align.START} xalign={0} />
                        <label class="pr-meta"
                            label={prs(l => l[i] ? `#${l[i].number}  ·  ${l[i].repository_url.split("/").slice(-1)[0]}` : "")}
                            halign={Gtk.Align.START} xalign={0} />
                    </box>
                ))}
            </box>
        </box>
    )
}

// ── GitHub Commits ─────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60)    return `${diff}s ago`
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

async function fetchCommits(): Promise<Commit[]> {
    try {
        const token = await ghToken()
        const authHeader = token ? ["-H", `Authorization: Bearer ${token}`] : []
        const out = await execAsync(["curl", "-sf",
            ...authHeader,
            "-H", "Accept: application/vnd.github+json",
            `https://api.github.com/search/commits?q=author:${GH_USER}&sort=author-date&order=desc&per_page=10`,
        ])
        type SearchCommit = {
            commit: { message: string; author: { date: string } }
            repository: { name: string }
        }
        const items = (JSON.parse(out) as { items?: SearchCommit[] }).items ?? []
        return items.slice(0, MAX_COMMITS).map(c => ({
            repo: c.repository.name,
            message: c.commit.message.split("\n")[0],
            relTime: relativeTime(c.commit.author.date),
        }))
    } catch { return [] }
}

function Commits() {
    const commits = createPoll<Commit[]>([], 600000, fetchCommits)
    return (
        <box orientation={V} class="commits-section">
            <label class="section-title" label="// COMMITS" halign={Gtk.Align.START} />
            <label class="pr-empty" label="no recent commits"
                halign={Gtk.Align.CENTER} visible={commits(l => l.length === 0)} />
            <box orientation={V} spacing={4} visible={commits(l => l.length > 0)}>
                {Array.from({ length: MAX_COMMITS }, (_, i) => (
                    <box orientation={V} class="commit-item" visible={commits(l => i < l.length)}>
                        <label class="commit-msg"
                            label={commits(l => l[i]?.message ?? "")}
                            maxWidthChars={36} ellipsize={3}
                            halign={Gtk.Align.START} xalign={0} />
                        <label class="commit-meta"
                            label={commits(l => l[i] ? `${l[i].repo}  ·  ${l[i].relTime}` : "")}
                            halign={Gtk.Align.START} xalign={0} />
                    </box>
                ))}
            </box>
        </box>
    )
}

// ── Dashboard window ───────────────────────────────────────────────────────

export default function Dashboard(gdkmonitor: Gdk.Monitor) {
    const { TOP, RIGHT } = Astal.WindowAnchor

    const win = (
        <window
            name="dashboard"
            class="Dashboard"
            gdkmonitor={gdkmonitor}
            visible={false}
            layer={Astal.Layer.OVERLAY}
            anchor={TOP | RIGHT}
            marginTop={50}
            marginRight={10}
            exclusivity={Astal.Exclusivity.NORMAL}
            keymode={Astal.Keymode.ON_DEMAND}
            application={app}
        >
            <scrolledwindow
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                propagateNaturalWidth
                propagateNaturalHeight
                maxContentHeight={900}
                maxContentWidth={300}
            >
                <box orientation={V} class="dashboard-inner">
                    <Clock />
                    <box class="sep" />
                    <CalendarWidget />
                    <box class="sep" />
                    <Stats />
                    <box class="sep" />
                    <GitHub />
                    <box class="sep" />
                    <Commits />
                </box>
            </scrolledwindow>
        </window>
    ) as unknown as Astal.Window

    const ctrl = new Gtk.EventControllerKey()
    ctrl.connect("key-pressed", (_: unknown, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) win.set_visible(false)
    })
    win.add_controller(ctrl)

    return win
}
