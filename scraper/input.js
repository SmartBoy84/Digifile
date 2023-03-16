chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
    if (request["type"] == "alert") {
        alert(request["message"])
    }
})

var excelInput = document.getElementById('excel');
excelInput.type = 'file';
let excelContents = null
excelInput.onchange = async e => excelContents = await processFile(e.target.files[0])

var progressInput = document.getElementById('progress');
progressInput.type = 'file';
let progressContents = null
progressInput.onchange = async e => progressContents = JSON.parse(await readAsString(e.target.files[0]))

let scraper = document.getElementById("scrape")

let start = document.getElementById("start")
let pause = document.getElementById("pause")

start.addEventListener("click", () => {
    if (excelContents) {

        alert("scraping time!")
        chrome.runtime.sendMessage({ "type": "contents", "contents": excelContents, "history": progressContents })

    } else {
        alert("atleast provide the excel sheet!")
    }
})
pause.addEventListener("click", () => chrome.runtime.sendMessage({ "type": "pause" }))

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