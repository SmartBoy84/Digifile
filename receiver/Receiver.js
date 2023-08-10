let debugFn = {
    hello: () => console.log("Hello world!")
}

// done this way to minimize the amount of injected code
// I override the alert prompt to prevent it from stopping code
window.addEventListener("message", function (event) {
    if (event.data.type && (event.data.type == "alert_message")) {
        let message = event.data.text
        console.log(`[ALERT_OVERRIDE] ${message}`);

        Object.keys(debugFn).includes(message) && debugFn[message]()
    }
})

let createPager = () => chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
    console.log("Message")

    if (request["type"] == "selection") {
        console.log("Sending my selection")
        reply({ "paths": getChecked() }) // if it's empty, it's empty
    }
})

window.addEventListener("DOMContentLoaded", async () => {
    let error

    console.log("loading...")
    let progressBar
    while (true) { // I tried a mutationserver - it didn't work for some reason
        await getWait(200)

        if (error = getError()) {
            break
        }

        if (!progressBar) {
            progressBar = document.querySelector("#loadingBar > .progress");
        }
        else if (progressBar.style.width === '100%') {
            console.log(progressBar.style.width)
            break
        }
    }

    createPager()

    if (!document.getElementById("pageNumber")) {
        console.log("Not in a document")
        return
    }

    let pageCount = document.getElementById("pageNumber").getAttribute("max")

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
        if (pageCount > response["maxPageCount"]) {
            error = error ? error : `page count [${response["maxPageCount"]}] exceeded`
        }
        else {
            if (!error) { // so far so good?
                response["name"] = response["name"]
                    .replaceAll("\/", `$$$$`) // must do this so that fixup utility can work later to recreate file hierarchy (maybe not needed?!)
                    .replace(/\.[^/.]+$/, ".pdf") // replace file extension at end with .pdf

                console.log(`Downloading file: ${response["name"]} at scalar res: ${response["resolution"]}`)
                error = await saveFile(false, response["name"], response["resolution"])
            }
            else { // if a file wasn't able to be scraped then save a dummy file so I know of it
                console.log("[WARNING]", error)

                let placeholderPDF = new jsPDF()
                await placeholderPDF.text(error, 10, 10)
                await placeholderPDF.save(response["name"])
            }
        }

        await chrome.runtime.sendMessage({ "type": "error", "name": response["name"], "error": error ? error : "" })
        window.close() // finitooo!
    }

    if (type == "traveller") {
        await traveller(response.scrollStride, response.scrollSpeed, response.time)
        window.close() // we're back - goodbye!
    }

    // enable download buttons
    let fileName = document.querySelector(".viewer-file-name").innerHTML.replace(/\.[^/.]+$/, ".pdf")

    let buttons = document.querySelectorAll(".toolbarButton")
    buttons.forEach(ele => {
        switch (ele.getAttribute("tabindex")) {
            case "22":
                enableButton(ele, () => saveFile(true, fileName, 0))
                break;

            case "23":
                enableButton(ele, () => saveFile(false, fileName, 0))
                break;
        }
    })
})