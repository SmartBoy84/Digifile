let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

let failure = {}
let currentlyRunning = 0
let scraping = false

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {

    if (request["type"] == "contents") {
        scrape(request["contents"])
    }

    if (request["type"] == "cancel") {
        chrome.runtime.reload()
    }

    if (request["type"] == "error") { // must listen for reply here to avoid race condition
        console.log("got reply from", request["name"])

        if (request["type"] == "error" && request["error"] && request["error"].length > 0) {

            failure[request["name"]] = request["error"]
            console.log("error: ", request["error"])

            reply({ "received": true })
        }

        currentlyRunning-- // finished!
        return true
    }

    // if (!sender.tab && !scraping) { // so that pages can load as per usual if not in scraping mode
    //     reply("")
    // }

    // return true
})

let waitForResponse = async (id, cFn) =>
    await new Promise((resolve, reject) => {
        chrome.runtime.onMessage.addListener(function (request, sender, reply) {

            if (sender.tab && sender.tab.id == id) {
                if (!cFn || (cFn && cFn(request, reply))) { // only stop listening if a callback function is defined and returns true or if it isn't defined

                    console.log("successfully exchanged message")
                    resolve(request)
                    chrome.runtime.onMessage.removeListener(arguments.callee)
                }
            }
            // return true
        })
    })

let saveData = async (fileName, data) => {

    console.log("Saving data...")
    let id = (await chrome.tabs.create({ url: chrome.runtime.getURL("reporter/reporter.html") })).id

    await waitForResponse(id, (request, reply) => {
        if (request["type"] == "downloader") {
            console.log("sending data to download...")

            reply({ "name": fileName, "data": data })
            return true
        }
        return false
    })

    await waitForResponse(id, (request, reply) => request["type"] == "downloader")
}
// let maxConcurrent = 5 

let scrape = async (contents) => {
    // await saveData("errors.txt", JSON.stringify(failure))
    scraping = true

    for (let i = 0; i < contents.length; i++) {

        currentlyRunning++

        let name = contents[i][0].replaceAll("\/", `$$$$`).replace(/\.[^/.]+$/, ".pdf")
        let url = contents[i][1]

        console.log(name, url)

        let id = (await chrome.tabs.create({ url: url })).id

        console.log("waiting for status request")
        await waitForResponse(id, (request, reply) => {
            if (request["type"] == "scrape") {
                reply(name)
                return true
            }
            return false
        })
        console.log("and we're off!")

        // page has been loaded, wait for download to finish - tab should report any errors
        console.log("waiting for reply from", name)
        console.log("moving on")
    }

    console.log("waiting for all downloads to finish")
    while (true) {
        await getWait(50)
        console.log(currentlyRunning)
        if (currentlyRunning == 0) {
            break
        }
    }

    console.log(failure)
    await saveData("errors.txt", JSON.stringify(failure))

    console.log("WE FINISHED BOI!")
    chrome.runtime.reload() // much easier this way
}