let excelInput = document.getElementById('excel');
let progressInput = document.getElementById('progress');

let progressContents = null
let excelContents = null

excelInput.type = 'file';
progressInput.type = 'file';

excelInput.onchange = async e => excelContents = await processFile(e.target.files[0])
progressInput.onchange = async e => {
    alert("progress history provided, removing all pre-scraped files")
    progressContents = JSON.parse(await readAsString(e.target.files[0]))
}

let maxInput = document.getElementById("max") // max number of tabs allowed to run at one time - if we have too many going at once then printing takes longer than our hardcoded timout value
maxInput.value = 3

let scraper = document.getElementById("scrape")

let start = document.getElementById("start")
let pause = document.getElementById("pause")

start.addEventListener("click", () => {
    let maxTabs = parseInt(maxInput.value)
    if (excelContents && maxTabs > 0) {

        alert("scraping time!")
        chrome.runtime.sendMessage({ "type": "contents", "contents": excelContents, "history": progressContents, "concurrent": maxTabs })

    } else {
        alert("atleast provide the correct input (number as max tabs, and excel sheet)!")
    }
})
pause.addEventListener("click", () => {
    alert("Let me finish these final few documents, please - then I'll stop and generate a progress report :)")
    chrome.runtime.sendMessage({ "type": "pause" })
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