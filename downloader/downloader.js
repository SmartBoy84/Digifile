/*
    I need to figure out a way to inject code to override the alert that shows when printing service isn't available
    this would return a negative response and cause the script to continue to query for printing until it is available
    tampermonkey can do it somehow
*/

/*    
var actualCode = `alert('foo');`;
        
    var script = document.createElement('script');
    script.textContent = actualCode;
    (document.head||document.documentElement).appendChild(script);
    alert("yo!")
    alert("injected")
*/

let printer = () => {
    document.getElementById("print").click()
    chrome.runtime.sendMessage({ type: "print", printed: true }) // code will not reach here if printing fails (DOM tries to show alert box)
}

let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))
let printFile = async () => {
    console.log("Printing...")

    let status = false

    while (!status) {
        await getWait(200) // give it some time
        printer()

        await new Promise(resolve => {
            chrome.runtime.onMessage.addListener(async request => {
                if (request["type"] == "print") {
                    status = request["printed"]
                    resolve()
                }
            })
        })
    }
}

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
    console.log("Downloading")

    /* await */ printFile() // print the file - don't wait for this, that's handled by the mutation observer

    let printService = document.querySelector("#printServiceOverlay")

    await new Promise(resolve => { // wait for page load
        new MutationObserver((mutations, observer) => {
            for (var mutation of mutations) {

                if (mutation.type == "attributes" && printService.getAttribute("class").includes("hidden")) {
                    console.log("finished rendering, stopping printer")

                    observer.disconnect()
                    resolve()
                }
            }
        }).observe(printService, { attributes: true })
    })

    let collection = document.querySelector("#printContainer").cloneNode(true)
    document.getElementById("printCancel").click() // so that the print dialog doesn't appear

    // start PDF compilation
    let finalPDF = new jsPDF()
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
    let error

    console.log("loading...")
    try {
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
                        return
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
        })
    } catch (failError) {
        console.log(`Failed to load: ${failError}`)
        error = failError
        return
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

    // necessary delay - FIX ME!
    let pageCount = document.querySelector("#pageNumber").getAttribute("max") // in case I ever need it, I previously used this as a hacky way to esure page had loaded
    console.log(`Loaded ${pageCount} pages!`)
    await getWait(pageCount * 200) // ugh, I don't know man!

    // cater for scraper's demands, if present
    console.log("loaded, asking for my type")
    let response = await chrome.runtime.sendMessage({ "type": "document" }) // if there is no reply, then this is a normal document

    let type = response ? response["type"] : "normal"
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
})