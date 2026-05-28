import app from "ags/gtk4/app"
import style from "./style.scss"
import Dashboard from "./widget/Dashboard"
import PRNotify from "./widget/PRNotify"
import InfoBar from "./widget/InfoBar"

app.start({
    css: style,
    instanceName: "nightmare-shell",
    requestHandler(argv, res) {
        if (argv[0] === "toggle-dashboard") {
            app.toggle_window("dashboard")
        }
        res("ok")
    },
    main() {
        const monitors = app.get_monitors()
        const primary = monitors[0]
        Dashboard(primary)
        PRNotify(primary)
        InfoBar(primary)
    },
})
