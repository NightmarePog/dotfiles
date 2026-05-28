import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import GLib from "gi://GLib?version=2.0"
import GtkLayerShell from "gi://Gtk4LayerShell?version=1.0"

const V = Gtk.Orientation.VERTICAL
const H = Gtk.Orientation.HORIZONTAL

const HOME = GLib.get_home_dir()!

interface MiniStats { ram: number; gpu: number }
interface CalEvent  { title: string; start: string }

export default function InfoBar(gdkmonitor: Gdk.Monitor) {
    const { BOTTOM, RIGHT } = Astal.WindowAnchor

    const time  = createPoll("--:--",  1000,  "date '+%H:%M'")
    const date  = createPoll("...",    60000, "date '+%A · %d %B'")

    const track = createPoll("", 5000, async () => {
        try {
            const status = await execAsync("playerctl status")
            if (status.trim() !== "Playing") return ""
            const artist = await execAsync("playerctl metadata artist")
            const title  = await execAsync("playerctl metadata title")
            const a = artist.trim(); const t = title.trim()
            return t ? (a ? `${a} — ${t}` : t) : ""
        } catch { return "" }
    })

    const events = createPoll<CalEvent[]>([], 120000, async () => {
        try {
            const out = await execAsync([`${HOME}/.config/ags/scripts/gcal_next.sh`])
            return JSON.parse(out) as CalEvent[]
        } catch { return [] }
    })

    const stats = createPoll<MiniStats>({ ram: 0, gpu: 0 }, 3000, async () => {
        try {
            const out = await execAsync([`${HOME}/.config/ags/scripts/infobar_stats.sh`])
            return JSON.parse(out) as MiniStats
        } catch { return { ram: 0, gpu: 0 } }
    })

    // Create hidden first so layer is set before the surface is mapped
    const win = (
        <window
            name="infobar"
            class="InfoBar"
            gdkmonitor={gdkmonitor}
            visible={false}
            layer={Astal.Layer.BOTTOM}
            anchor={BOTTOM | RIGHT}
            marginBottom={28}
            marginRight={28}
            exclusivity={Astal.Exclusivity.NORMAL}
            application={app}
        >
            <box orientation={V} class="desktop-widget" spacing={4}>
                <label class="dw-time"  label={time} halign={Gtk.Align.END} />
                <label class="dw-date"  label={date} halign={Gtk.Align.END} />

                <box class="dw-gap" />

                <box orientation={H} spacing={16}>
                    <box orientation={H} spacing={5}>
                        <label class="dw-icon" label="" />
                        <label class="dw-stat" label={stats(s => `${s.ram}%`)} />
                    </box>
                    <box orientation={H} spacing={5}>
                        <label class="dw-icon" label="󰊵" />
                        <label class="dw-stat" label={stats(s => `${s.gpu}%`)} />
                    </box>
                </box>

                <box orientation={H} spacing={6} visible={track(t => t.length > 0)}>
                    <label class="dw-icon" label="󰎆" />
                    <label class="dw-secondary" label={track} maxWidthChars={28} ellipsize={3} />
                </box>

                <box orientation={H} spacing={6} visible={events(e => e.length > 0)}>
                    <label class="dw-icon" label="󰃭" />
                    <label
                        class="dw-secondary"
                        label={events(e => e.length > 0 ? `${e[0].start}  ${e[0].title}` : "")}
                        maxWidthChars={28}
                        ellipsize={3}
                    />
                </box>
            </box>
        </window>
    ) as unknown as Astal.Window

    // Force BOTTOM layer before the surface maps, then show
    GtkLayerShell.set_layer(win, GtkLayerShell.Layer.BOTTOM)
    win.set_visible(true)

    return win
}
