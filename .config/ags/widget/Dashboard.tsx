import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { readFile } from "ags/file"
import { createPoll } from "ags/time"
import fetch from "ags/fetch"
import GLib from "gi://GLib?version=2.0"

const V = Gtk.Orientation.VERTICAL
const H = Gtk.Orientation.HORIZONTAL

const HOME = GLib.get_home_dir()!
const GH_TOKEN_FILE = `${HOME}/.config/ags/github_token`
const GH_USER = "NightmarePog"

interface StatsData {
    cpu: number
    ram: number
    ram_used: string
    ram_total: string
    gpu: number
    gpu_temp: number
    cpu_temp: number
    gpu_mhz: number
}

interface PR {
    number: number
    title: string
    repository_url: string
}

interface Commit {
    repo: string
    message: string
    relTime: string
}

const EMPTY_STATS: StatsData = {
    cpu: 0, ram: 0, ram_used: "0G", ram_total: "0G",
    gpu: 0, gpu_temp: 0, cpu_temp: 0, gpu_mhz: 0,
}

const MAX_PRS     = 5
const MAX_COMMITS = 6

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

    const markEvents = async () => {
        cal.clearMarks()
        try {
            const out = await execAsync(["gcalcli", "agenda", "--nocolor", "--tsv", "--military", "--days", "40"])
            const year = cal.year
            const month = cal.month + 1  // GtkCalendar is 0-based
            for (const line of out.split("\n")) {
                const parts = line.split("\t")
                if (parts.length < 2 || parts[0] === "start_date") continue
                const [y, m, d] = parts[0].split("-").map(Number)
                if (y === year && m === month) cal.markDay(d)
            }
        } catch { /* gcalcli unavailable */ }
    }

    markEvents()
    cal.connect("prev-month", markEvents)
    cal.connect("next-month", markEvents)
    cal.connect("prev-year",  markEvents)
    cal.connect("next-year",  markEvents)

    return (
        <box orientation={V} class="calendar-section">
            <label class="section-title" label="// CALENDAR" halign={Gtk.Align.START} />
            {cal}
        </box>
    )
}

// ── Stats ──────────────────────────────────────────────────────────────────

function StatRow(props: {
    icon: string
    label: string
    fraction: import("gnim").Accessor<number>
    detail: import("gnim").Accessor<string>
    barCssName: string
}) {
    return (
        <box orientation={V} class="stat-row">
            <box orientation={H} class="stat-header">
                <label
                    class="stat-label"
                    label={`${props.icon}  ${props.label}`}
                    hexpand
                    halign={Gtk.Align.START}
                />
                <label class="stat-detail" label={props.detail} />
            </box>
            <Gtk.ProgressBar cssName={props.barCssName} fraction={props.fraction} />
        </box>
    )
}

function Stats() {
    const stats = createPoll<StatsData>(EMPTY_STATS, 2000, async () => {
        try {
            const out = await execAsync([`${HOME}/.config/ags/scripts/stats.sh`])
            return JSON.parse(out) as StatsData
        } catch {
            return EMPTY_STATS
        }
    })

    return (
        <box orientation={V} class="stats-section">
            <label class="section-title" label="// SYSTEM" halign={Gtk.Align.START} />
            <StatRow
                icon=""
                label="CPU"
                fraction={stats(s => Math.min(1, s.cpu / 100))}
                detail={stats(s => `${s.cpu}%  ·  ${s.cpu_temp}°C`)}
                barCssName="stat-bar-cpu"
            />
            <StatRow
                icon=""
                label="RAM"
                fraction={stats(s => Math.min(1, s.ram / 100))}
                detail={stats(s => `${s.ram_used} / ${s.ram_total}`)}
                barCssName="stat-bar-ram"
            />
            <StatRow
                icon="󰊵"
                label="GPU"
                fraction={stats(s => Math.min(1, s.gpu / 100))}
                detail={stats(s => `${s.gpu}%  ·  ${s.gpu_temp}°C  ·  ${s.gpu_mhz}MHz`)}
                barCssName="stat-bar-gpu"
            />
        </box>
    )
}

// ── GitHub PRs ─────────────────────────────────────────────────────────────

async function fetchPRs(): Promise<PR[]> {
    try {
        const token = readFile(GH_TOKEN_FILE).trim()
        if (!token) return []
        const res = await fetch(
            `https://api.github.com/search/issues?q=is:pr+is:open+involves:${GH_USER}&per_page=8`,
            { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
        )
        const data = await res.json() as { items?: PR[] }
        return data.items ?? []
    } catch {
        return []
    }
}

function GitHub() {
    const prs = createPoll<PR[]>([], 300000, async () => fetchPRs())

    return (
        <box orientation={V} class="github-section">
            <label class="section-title" label="// PULL REQUESTS" halign={Gtk.Align.START} />
            <label
                class="pr-empty"
                label="no open review requests"
                halign={Gtk.Align.CENTER}
                visible={prs(list => list.length === 0)}
            />
            <box orientation={V} spacing={4} visible={prs(list => list.length > 0)}>
                {Array.from({ length: MAX_PRS }, (_, i) => (
                    <box orientation={V} class="pr-item" visible={prs(list => i < list.length)}>
                        <label
                            class="pr-title"
                            label={prs(list => list[i]?.title ?? "")}
                            maxWidthChars={36}
                            ellipsize={3}
                            halign={Gtk.Align.START}
                            xalign={0}
                        />
                        <label
                            class="pr-meta"
                            label={prs(list => list[i]
                                ? `#${list[i].number}  ·  ${list[i].repository_url.split("/").slice(-1)[0]}`
                                : ""
                            )}
                            halign={Gtk.Align.START}
                            xalign={0}
                        />
                    </box>
                ))}
            </box>
        </box>
    )
}

// ── GitHub Commits ─────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
    if (diff < 60)    return `${diff}s ago`
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

async function fetchCommits(): Promise<Commit[]> {
    try {
        const token = readFile(GH_TOKEN_FILE).trim()
        const headers: Record<string, string> = { Accept: "application/vnd.github+json" }
        if (token) headers["Authorization"] = `Bearer ${token}`
        const res = await fetch(
            `https://api.github.com/users/${GH_USER}/events?per_page=30`,
            { headers },
        )
        const events = await res.json() as Array<{
            type: string
            repo: { name: string }
            payload: { commits?: Array<{ message: string }> }
            created_at: string
        }>
        const commits: Commit[] = []
        for (const ev of events) {
            if (ev.type !== "PushEvent") continue
            const repo = ev.repo.name.replace(`${GH_USER}/`, "")
            for (const c of (ev.payload.commits ?? []).slice(0, 2)) {
                commits.push({
                    repo,
                    message: c.message.split("\n")[0],
                    relTime: relativeTime(ev.created_at),
                })
                if (commits.length >= MAX_COMMITS) break
            }
            if (commits.length >= MAX_COMMITS) break
        }
        return commits
    } catch {
        return []
    }
}

function Commits() {
    const commits = createPoll<Commit[]>([], 600000, async () => fetchCommits())

    return (
        <box orientation={V} class="commits-section">
            <label class="section-title" label="// COMMITS" halign={Gtk.Align.START} />
            <label
                class="pr-empty"
                label="no recent commits"
                halign={Gtk.Align.CENTER}
                visible={commits(list => list.length === 0)}
            />
            <box orientation={V} spacing={4} visible={commits(list => list.length > 0)}>
                {Array.from({ length: MAX_COMMITS }, (_, i) => (
                    <box orientation={V} class="commit-item" visible={commits(list => i < list.length)}>
                        <label
                            class="commit-msg"
                            label={commits(list => list[i]?.message ?? "")}
                            maxWidthChars={36}
                            ellipsize={3}
                            halign={Gtk.Align.START}
                            xalign={0}
                        />
                        <label
                            class="commit-meta"
                            label={commits(list => list[i]
                                ? `${list[i].repo}  ·  ${list[i].relTime}`
                                : ""
                            )}
                            halign={Gtk.Align.START}
                            xalign={0}
                        />
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
