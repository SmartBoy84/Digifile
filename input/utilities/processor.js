let setUpdater = (type, event) => document.querySelectorAll(`.${type}`)
    .forEach(element =>
        element.addEventListener(event, async (e) =>
            await interface[element.dataset.type].eventHandler(e)
        )
    )

let readAsString = (file) =>
    new Promise((resolve, reject) => {

        let reader = new FileReader();
        reader.readAsText(file);

        reader.onerror = () => reject()
        reader.onload = (e) => resolve(reader.result)
    })

let processExcelFile = (file) =>
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
                    .replace(/^\/+/, '') // remove initial / if present
                    , a[3]])

            if (data.length > 0) {
                resolve(data)
            } else {
                alert("Excel sheet is empty!")
                reject()
            }
        }

        reader.onerror = () => {
            console.log("Failed")
            reject()
        }

        reader.readAsBinaryString(file);
    })