import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { readFile } from "ags/file"
import { createPoll } from "ags/time"
import fetch from "ags/fetch"
import GLib from "gi://GLib?version=2.0"

const HOME = GLib.get_home_dir()!
const GH_TOKEN_FILE = `${HOME}/.config/ags/github_token`
const GH_USER = "NightmarePog"

async function fetchPRCount(): Promise<number> {
    try {
        const token = readFile(GH_TOKEN_FILE).trim()
        if (!token) return 0
        const res = await fetch(
            `https://api.github.com/search/issues?q=is:pr+is:open+involves:${GH_USER}&per_page=1`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json",
                },
            },
        )
        const data = await res.json() as { total_count?: number }
        return data.total_count ?? 0
    } catch {
        return 0
    }
}

export default function PRNotify(gdkmonitor: Gdk.Monitor) {
    const { TOP, RIGHT } = Astal.WindowAnchor

    const count = createPoll(0, 300000, async () => fetchPRCount())

    return (
        <window
            name="pr-notify"
            class="PRNotify"
            gdkmonitor={gdkmonitor}
            visible={count(c => c > 0)}
            layer={Astal.Layer.OVERLAY}
            anchor={TOP | RIGHT}
            marginTop={8}
            marginRight={8}
            exclusivity={Astal.Exclusivity.NORMAL}
            application={app}
        >
            <button
                class="pr-badge"
                onClicked={() => execAsync("ags request --instance nightmare-shell toggle-dashboard")}
                tooltipText="open dashboard"
            >
                <box spacing={6}>
                    <label class="pr-icon" label="󰊤" />
                    <label class="pr-count" label={count(c => `${c} PR${c !== 1 ? "s" : ""}`)} />
                </box>
            </button>
        </window>
    )
}
