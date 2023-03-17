let excelInput = document.getElementById('excel');
let progressInput = document.getElementById('progress');

let progressContents = null
let excelContents = null

excelInput.type = 'file';
progressInput.type = 'file';

excelInput.onchange = async e => excelContents = await processFile(e.target.files[0])
progressInput.onchange = async e => {
    alert("progress history provided, will remove all pre-scraped files")
    progressContents = JSON.parse(await readAsString(e.target.files[0]))
}

let maxPages = document.getElementById("maxPages") // max number of tabs allowed to run at one time - if we have too many going at once then printing takes longer than our hardcoded timout value
let minTime = document.getElementById("minTime") // minimum time to spend on each page
let maxTime = document.getElementById("maxTime") // max time to spend on each page

maxPages.value = 3
minTime.value = 30
maxTime.value = 50

let start = document.getElementById("start")
let pause = document.getElementById("pause")
let roam = document.getElementById("roam")

start.addEventListener("click", () => {

    if (!excelContents) {
        alert("please provide excel file listing")
        return
    }

    let maxTabs = parseInt(maxPages.value)

    if (maxTabs == 0) {
        alert("please specify max concurrent tabs to open!")
        return
    }

    alert("scraping time!")
    chrome.runtime.sendMessage({ "type": "contents", "contents": excelContents, "history": progressContents, "concurrent": maxTabs })
})

pause.addEventListener("click", () => {
    chrome.runtime.sendMessage({ "type": "stop" })
})

roam.addEventListener("click", () => {

    let max = parseInt(maxTime.value)
    let min = parseInt(minTime.value)
    let maxTabs = parseInt(maxPages.value)

    if (!max || !min) {
        alert("Please specify both max/min times to roam!")
        return
    }

    if (maxTabs == 0) {
        alert("please specify max concurrent tabs to open!")
        return
    }

    if (!excelContents) {
        alert("please provide excel file listing")
        return
    }

    alert("Starting traveller, happy studying!")
    chrome.runtime.sendMessage({ "type": "roam", "max": max, "min": min, "contents": excelContents, "concurrent": maxTabs })
})

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