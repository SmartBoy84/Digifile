let magicStrings = {
    print_errors: ["to be initialized"]
}

let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

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

let sendMessage = (data) => window.postMessage(data, "*");

// done this way to minimize the amount of injected code
// I override the alert prompt to prevent it from stopping code
window.addEventListener("message", function (event) {
    if (event.data.type && (event.data.type == "alert_message")) {
        let message = event.data.text
        console.log(`[ALERT_OVERRIDE] ${message}`);

        if (message == "print") {
            renderFile()
        }
    }
})

function renderFile() {
    return new Promise(async (masterResolve, masterReject) => {
        console.log("rendering routine initialised")

        let status = false

        while (!status) {
            document.getElementById("print").click() // start printing

            let error = getError();
            if (error) {
                console.log(error) // -> saveFile -> mainRoutine -> downloader.js -> saved into file
                masterReject(error)
                return
            }

            await new Promise(resolve =>
                window.addEventListener("message", function (event) {
                    if (event.data.type && (event.data.type == "print")) {
                        status = event.data.text && !magicStrings.print_errors.some(error_str => event.data.text.includes(error_str))
                        console.log(`Response: ${event.data.text}`, status)
                        resolve()
                    }
                })
            )

            await getWait(200) // give it some time before going at it again
        }

        console.log("waiting for renderer")
        let printService = document.querySelector("#printServiceOverlay")

        await new Promise(resolve => { // step 2 - wait for page load
            new MutationObserver((mutations, observer) => {
                for (var mutation of mutations) {

                    if (mutation.type == "attributes" && printService.getAttribute("class").includes("hidden")) {
                        observer.disconnect()
                        resolve()
                    }
                }
            }).observe(printService, { attributes: true })
        })

        let collection = document.querySelector("#printContainer").cloneNode(true)
        document.getElementById("printCancel").click() // so that the print dialog doesn't appear

        console.log("renderer finished")
        masterResolve(collection)
    })
}

let printer = async () => {
    console.log("Printing...")
    document.getElementById("print").click() // start printing
}

let saveFile = async (newPage, pathName) => {
    try {
        console.log("Downloading")

        // render file
        let collection = await (renderFile())

        // start PDF compilation
        let finalPDF = new jsPDF()
        let images = collection.querySelectorAll("img")

        if (images.length == 0) {
            throw "empty document?"
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
    } catch (error) {
        console.log(`Error saving file: ${error}`)
        return error
    }
}

let enableButton = (ele, cFn) => {

    let clone = ele.cloneNode(true)

    clone.removeAttribute("disabled")
    clone.addEventListener("click", () => cFn())

    ele.parentNode.replaceChild(clone, ele)
}

window.addEventListener("DOMContentLoaded", async () => {
    let error

    console.log("loading...")
    await new Promise((resolve, reject) => {
        let progressBar

        new MutationObserver((mutations, observer) => {
            for (let mutation of mutations) {

                if (mutation.type === 'childList' && document.querySelector("dataroom-layout")) {
                    reject("not in a document")
                }

                let pageError = getError();
                if (pageError) {
                    reject(pageError)
                }

                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (!progressBar) {
                        progressBar = document.querySelector("#loadingBar > .progress");
                    }
                    else if (progressBar.style.width === '100%') {
                        console.log(progressBar.style.width)
                        observer.disconnect();
                        resolve()
                    }
                }
            }
        }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] }) // we want to watch for element additions and style changes
    }).catch(failError => {
        error = failError
    })

    // necessary delay - FIX ME - FIXEDDD!!!
    // let pageCount = document.querySelector("#pageNumber").getAttribute("max") // in case I ever need it, I previously used this as a hacky way to esure page had loaded
    // console.log(`Loaded ${pageCount} pages!`)
    // await getWait(pageCount * 200) // ugh, I don't know man!

    // cater for scraper's demands, if present
    console.log("loaded, asking for my type")

    let response = await chrome.runtime.sendMessage({ "type": "document" }) // if there is no reply, then this is a normal document
    if (!response) {
        console.log("[ERROR] Backend failed to respond")
        return
    }

    let type = response ? response["type"] : "no response"
    console.log("My type is:", type)

    // carry out backend's requests
    var event = new CustomEvent("beforeprint")
    document.dispatchEvent(event)

    if (type == "scraper") {
        console.log(response["name"])

        if (!error) { // so far so good?
            console.log("Downloading file")
            error = await saveFile(false, response["name"])
        }

        if (error) { // if a file wasn't able to be scraped then save a dummy file so I know of it
            console.log("[WARNING]", error)
            let placeholderPDF = new jsPDF()
            await placeholderPDF.text(error, 10, 10)
            await placeholderPDF.save(response["name"])
        }

        await chrome.runtime.sendMessage({ "type": "error", "name": response["name"], "error": error ? error : "" })
        window.close() // finitooo!
    }

    if (type == "traveller") {

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

    // enable download buttons
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