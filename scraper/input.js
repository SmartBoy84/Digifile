// download a list of any errors that were encountered
// chrome.runtime.onMessage.addListener(
//     function (request, sender, sendResponse) {
//         if (request["type"] == "download") {
//             var a = document.createElement("a");
//             var file = new Blob([request["data"]], { type: "text/plain" });
//             a.href = URL.createObjectURL(file);
//             a.download = request["filename"]
//             a.click();
//         }
//     }
// );

var input = document.createElement('input');
input.type = 'file';

let scraper = document.getElementById("scrape")
scraper.style.backgroundColor = "green"

let cancel = document.getElementById("cancel")

scraper.addEventListener("click", () => {
    input.click()
})

cancel.addEventListener("click", () => chrome.runtime.sendMessage({ "type": "cancel" }))

function processFile(file) {
    return new Promise((resolve, reject) => {
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
                .map(a => [`${a[5]}/${a[0].trim()}`.replaceAll(/(?<=\/)(\d+\.?)+\s?/g, ""), a[3]])

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
}

input.onchange = async e => {
    let contents = await processFile(e.target.files[0])
    
    alert("Scraping time!")
    chrome.runtime.sendMessage({ "type": "contents", "contents": contents })
}