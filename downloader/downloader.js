let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))
let printFile = () => document.getElementById("print").click()

let getError = () => {

    let pass = document.querySelector("#passwordOverlay")
    if (pass && !pass.getAttribute("class").includes("hidden")) {
        return "document locked"
    }

    let unsupported = document.querySelector(".rf-block")
    if (unsupported && !unsupported.hidden) { return "document couldn't be loaded" }

    let excel = document.querySelector(".spread-sheet-content") // god damn excel documentsss!
    if (excel && !excel.hidden) { return "excel documents not supported" }
}


function urlContentToDataUri(url) {
    return fetch(url)
        .then(response => response.blob())
        .then(blob => new Promise(callback => {
            let reader = new FileReader();
            reader.onload = function () { callback(this.result) };
            reader.readAsDataURL(blob);
        }));
}

let saveFile = async (newPage, pathName) => {

    let error = getError()
    if (error) {
        // console.log("File locked, aborting")
        return error
    }

    let printService = document.querySelector("#printServiceOverlay")
    let finalPDF = new jsPDF()

    let wait = new Promise((resolve, reject) => {
        new MutationObserver((mutations, observer) => {
            for (var mutation of mutations) {

                if (mutation.type == "attributes" && printService.getAttribute("class").includes("hidden")) {
                    console.log("finished rendering")

                    // adder.disconnect()
                    observer.disconnect()
                    resolve()
                }
            }
        }).observe(printService, { attributes: true })
    })

    printFile()
    await wait

    let collection = document.querySelector("#printContainer").cloneNode(true)
    document.getElementById("printCancel").click()

    let images = collection.querySelectorAll("img")

    if (images.length == 0) {
        return "empty document?"
    }

    for (let i = 0; i < images.length; i++) {
        finalPDF.addImage(images[i], 'JPEG', 0, 0, 210, 297, '', 'FAST') // I have no clue what these magic values are - maybe I'll check them out?
        if (i < images.length - 1) {
            await finalPDF.addPage() // so that a blank page isn't added at the end
        }
    }

    if (newPage) {
        window.open(URL.createObjectURL(finalPDF.output("blob")), "_self")
    }
    else {
        finalPDF.save(pathName)
    }
}

let enableButton = (ele, cFn) => {

    let clone = ele.cloneNode(true)

    clone.removeAttribute("disabled")
    clone.addEventListener("click", () => cFn())

    ele.parentNode.replaceChild(clone, ele)
}

window.addEventListener("DOMContentLoaded", async () => {

    console.log("loading...")
    // while (true) {
    //     await getWait(200)

    //     if (document.querySelector("dataroom-layout")) {
    //         console.log("not in a document")
    //         return
    //     }

    //     let error = getError()
    //     if (error) {
    //         console.log("[warning] ", error)
    //         break
    //     }
    //     let progress = document.querySelector("#loadingBar > .progress")
    //     if (progress) {
    //         if (progress.style.width == 100) {
    //             break
    //         }
    //         console.log(`Width: ${progress.style.width}`)
    //     }
    // }
    let error
    try {
        await new Promise((resolve, reject) => {
            let progressBar
            let observer = new MutationObserver((mutations, observer) => {
                for (let mutation of mutations) {
                    if (mutation.type === 'childList' && document.querySelector("dataroom-layout")) {
                        reject("not in a document")
                    }
                    error = getError();
                    if (error) {
                        console.log("[warning] ", error);
                        resolve()
                    }

                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        if (!progressBar) {
                            progressBar = document.querySelector("#loadingBar > .progress");
                        }

                        if (progressBar && progressBar.style.width === '100%') {
                            console.log(progressBar.style.width)
                            observer.disconnect();
                            resolve()
                        }
                    }
                }
            }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] }) // we want to watch for element additions and style changes
        })
    } catch (failError) {
        console.log(`Failed to load: ${failError}`)
        return
    }

    let pageCount = document.querySelector("#pageNumber").getAttribute("max") // in case I ever need it, I previously used this as a hacky way to esure page had loaded
    console.log(`Loaded ${pageCount} pages!`)

    // cater for scraper's demands, if present
    console.log("loaded, asking for my type")
    let response = await chrome.runtime.sendMessage({ "type": "document" }) // if there is no reply, then this is a normal document

    console.log("My type is:", response ? response["type"] : "normal page")

    // prepare printing
    var event = new CustomEvent("beforeprint")
    document.dispatchEvent(event)

    if (response) {
        if (response["type"] == "scraper") {
            console.log(response["name"])

            if (!error) { // so far so good?
                error = await saveFile(false, response["name"])
            }

            if (error) { // if a file wasn't able to be scraped then save a dummy file so I know of it
                let placeholderPDF = new jsPDF()
                await placeholderPDF.text(error, 10, 10)
                await placeholderPDF.save(response["name"])
            }

            await chrome.runtime.sendMessage({ "type": "error", "name": response["name"], "error": error ? error : "" })

        } else if (response["type"] == "traveller" && !getError()) {

            let max = parseInt(document.getElementById("viewer").offsetHeight)
            let intervals = Math.floor(response["time"] / response["scrollSpeed"])
            let viewer = document.getElementById("viewerContainer")

            if (max > 0) {

                let current = 0
                console.log(response)

                let adder = response["scrollStride"]

                while (intervals-- > 0) {

                    await getWait(response["scrollSpeed"])
                    current += adder

                    viewer.scroll(0, current)

                    if (current <= 0 || current >= max) {
                        adder *= -1
                        current = current >= max ? max : current <= 0 ? 0 : current
                    }
                }
            }
        }

        window.close() // wicked
    }

    let fileName = document.querySelector(".viewer-file-name").innerHTML.replace(/\.[^/.]+$/, ".pdf")

    let buttons = document.querySelectorAll(".toolbarButton")
    buttons.forEach(ele => {
        switch (ele.getAttribute("tabindex")) {
            case "22":
                enableButton(ele, () => saveFile(true, fileName))
                break;

            case "23":
                enableButton(ele, () => saveFile(false, fileName))
                break;
        }
    })
})