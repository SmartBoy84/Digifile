let settings = {
    "maxPages": 3, // max number of concurrent pages
    "minTime": 30, // min
    "maxTime": 50, // min
    "scrollSpeed": 5, // seconds
    "scrollStride": 100, // px
    "resolution": 1.5 // scalar
}

// just trying out a new way of doing things
let interface = {
    "excel": {
        eventHandler: async function (e) { this.data = await processExcelFile(e.target.files[0]); console.log(this, interface) }
    },

    "progress": {
        eventHandler: async function (e) {
            alert("progress history provided, will remove all pre-scraped files")
            this.data = JSON.parse(await readAsString(e.target.files[0]))
        }
    },
    "start": {
        eventHandler: () => {
            if (!interface["excel"]["data"]) {
                alert("please provide excel file listing")
                return
            }

            if (settings["maxPages"] == 0) {
                alert("please specify max concurrent tabs to open!")
                return
            }

            chrome.runtime.sendMessage({ "type": "contents", "contents": interface["excel"]["data"], "history": interface["progress"]["data"], ...settings })
        }
    },
    "pause":
    {
        eventHandler: () => chrome.runtime.sendMessage({ "type": "stop" })
    },

    "roam": {
        eventHandler: () => {
            if (!settings["maxTime"] || !settings["minTime"] || !settings["scrollSpeed"] || !settings["scrollStride"]) {
                alert("Please specify all roamer settings!")
                return
            }

            if (!settings["maxPages"]) {
                alert("please specify max concurrent tabs to open!")
                return
            }

            if (!interface["excel"]["data"]) {
                alert("please provide excel file listing")
                return
            }

            alert("Starting traveller, happy studying!")
            chrome.runtime.sendMessage({ "type": "roam", "contents": interface["excel"]["data"], ...settings })
        }
    },

    "resolution": {
        eventHandler: (e) => {
            document.getElementById("resolution").innerHTML =
                e.target.value == e.target.dataset.default ? "default"
                    : e.target.value == 0 ? "Max" :
                        e.target.value

            if (e.target.value == "0") {
                e.stopImmediatePropagation() // Stop!! So that I don't have to race to add my value to settings object
                settings[e.target.dataset.type] = parseFloat(999) // zoom greater than about 10 causes the highest possible quality to be used
            }
        }
    }
}

// setup
setUpdater("button", "click")
setUpdater("fileInput", "input")
setUpdater("slider", "input")

document.querySelectorAll(".setting")
    .forEach(setting => {
        let name = setting.dataset.type

        setting.addEventListener("input", async (e) =>
            settings[e.target.dataset.type] = parseFloat(e.target.value)
        )

        setting.value = settings[name]
        setting.dataset.default = settings[name]

        setting.dispatchEvent(new Event('input'));
    })