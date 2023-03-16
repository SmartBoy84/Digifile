let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

// flags because extensisons' addListener() is pedantic
let failure = {}
let success = []
let currentlyRunning = 0
let scraping = false

let alertBridge = (str) => chrome.runtime.sendMessage({ "type": "alert", "message": str })

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {

    if (request["type"] == "contents") {

        let contents = request["contents"]
        success = request["history"]

        if (request["history"]) {
            alertBridge("progress history provided, removing all pre-scraped files")

            console.log("Entries before: ", contents.length)
            contents = contents.filter(a => !success.some(b => {
                // console.log(b[0], a)
                if (a[0] == b) {
                    console.log("Found")
                }
                return a[0] == b
            }))
            console.log("Entries after: ", contents.length)
        }

        scrape(request["contents"])
    }

    if (request["type"] == "pause") {
        scraping = false
        alertBridge("Let me finish these final few documents, please - then I'll stop and generate a progress report :)")
    }

    if (request["type"] == "error") { // must listen for reply here to avoid race condition
        console.log("got reply from", request["name"])

        if (request["type"] == "error") {
            if (request["error"] && request["error"].length > 0) {
                failure[request["name"]] = request["error"]
                console.log("error: ", request["error"])

                reply({ "received": true })

            } else {
                success.push(request["name"])
            }
        }

        currentlyRunning-- // finished!
        return true
    }
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

let maxConcurrent = 3 // if we have too many going at once then printing takes longer than our hardcoded timout value

let scrape = async (contents) => {
    // await saveData("errors.txt", JSON.stringify(failure))
    scraping = true

    for (let i = 0; i < contents.length; i++) {

        if (scraping == false) {
            break
        }

        // if more that the maxConcurrent are running at once then wait for one to finish before continuing
        if (currentlyRunning >= maxConcurrent) {
            console.log("Reached capacity! Waiting for one to finish...")

            await new Promise((resolve, reject) => {
                chrome.runtime.onMessage.addListener(function (request, sender, reply) {

                    if (sender.tab && sender.tab.id && request["type"] == "error") {

                        resolve()
                        chrome.runtime.onMessage.removeListener(arguments.callee)
                    }
                })
            })
        }

        currentlyRunning++

        let name = contents[i][0]
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
        console.log("waiting for reply from", name) // this has been moved to the "master" listener
    }

    console.log("waiting for all downloads to finish")
    while (true) {
        await getWait(100) // eh, hacky is my middle name
        if (currentlyRunning == 0) {
            break
        }
    }

    console.log(failure)
    if (scraping) {
        await saveData("errors.txt", JSON.stringify(failure))
    } else {
        await saveData("progress.txt", JSON.stringify(success)) // we don't need to track errors
    }

    console.log("WE FINISHED BOI!")
    chrome.runtime.reload() // much easier this way
}