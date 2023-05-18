let files = {

    "excel": {
        "onchange": async e => await processFile(e.target.files[0])
    },

    "progress": {
        "onchange": async e => {
            alert("progress history provided, will remove all pre-scraped files")
            return JSON.parse(await readAsString(e.target.files[0]))
        }
    }
}

for (let fileInput of document.querySelectorAll(".fileInput")) {

    let name = fileInput.dataset.type
    fileInput.onchange = async (e) => files[name]["data"] = await files[name]["onchange"](e)

    fileInput.dataset.type = 'file'
}

let settings = {
    "maxPages": 3, // max number of concurrent pages
    "minTime": 30, // min
    "maxTime": 50, // min
    "scrollSpeed": 5, // seconds
    "scrollStride": 100 // px
}

let syncSetting = () => {

    let settingEl = document.querySelectorAll(".setting")

    for (let setting of settingEl) {
        let name = setting.dataset.type

        if (!setting.value) {
            setting.value = settings[name]
        } else {
            settings[name] = parseFloat(setting.value)
        }
    }
}
syncSetting()

let interface = {
    "start": () => {

        if (!files["excel"]["data"]) {
            alert("please provide excel file listing")
            return
        }

        if (settings["maxPages"] == 0) {
            alert("please specify max concurrent tabs to open!")
            return
        }

        chrome.runtime.sendMessage({ "type": "contents", "contents": files["excel"]["data"], "history": files["progress"]["data"], ...settings })
    },

    "pause": () => {
        chrome.runtime.sendMessage({ "type": "stop" })
    },

    "roam": () => {

        if (!settings["maxTime"] || !settings["minTime"] || !settings["scrollSpeed"] || !settings["scrollStride"]) {
            alert("Please specify all roamer settings!")
            return
        }

        if (!settings["maxPages"]) {
            alert("please specify max concurrent tabs to open!")
            return
        }

        if (!files["excel"]["data"]) {
            alert("please provide excel file listing")
            return
        }

        alert("Starting traveller, happy studying!")
        chrome.runtime.sendMessage({ "type": "roam", "contents": files["excel"]["data"], ...settings })
    }
}

for (let button of document.querySelectorAll(".button")) {

    let name = button.dataset.type

    button.addEventListener("click", () => {
        syncSetting()
        interface[name]()
    })
}

let readAsString = (file) =>
    new Promise((resolve, reject) => {

        let reader = new FileReader();
        reader.readAsText(file);

        reader.onerror = () => reject()
        reader.onload = (e) => resolve(reader.result)
    })

let processFile = (file) =>
    new Promise((resolve, reject) => {
        let reader = new FileReader();

        reader.onload = (e) => {
            var data = e.target.result
            var workbook = XLSX.read(data, {
                type: 'binary'
            })
            if (!workbook) {
                alert("NOT AN EXCEL SHEET!")
                reject()
            }

            let sheet = workbook.Sheets[workbook.SheetNames[0]]
            var data = XLSX.utils.sheet_to_json(sheet, { header: true })
                .map(a => Object.values(a))
                .filter(a => a[1] == "File")

                .map(a => [`${a[5]}/${a[0].trim()}`
                    .replaceAll(/(?<=\/)(\d+\.?)+\s?/g, "") // strip numbers before the name
                    .replaceAll("\/", `$$$$`).replace(/\.[^/.]+$/, ".pdf") // replace '/' with '$$'
                    , a[3]])

            if (data.length > 0) {
                resolve(data)
            } else {
                reject()
            }
        }

        reader.onerror = () => {
            console.log("Failed")
            reject()
        }

        reader.readAsBinaryString(file);
    })