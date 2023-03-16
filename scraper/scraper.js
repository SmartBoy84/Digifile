// let alertBridge = (str) => chrome.runtime.sendMessage({ "type": "alert", "message": str })

let scraping = false // ugh, global variable needed to catch scraper routine

let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {

    if (request["type"] == "contents") {
        console.log("max", request["concurrent"])
        scrape(request["contents"], request["history"], request["concurrent"])
    }

    if (request["type"] == "pause") {
        scraping = false
    }

})

let waitForResponse = (cFn, id) =>
    new Promise(async (resolve, reject) => {

        let tabRemoval = function (tabId, removeInfo) {
            if (tabId == id) {

                chrome.tabs.onRemoved.removeListener(arguments.callee)
                console.log("tab closed: ", tabId)

                reject("tab closed")
            }
        }

        if (id) {
            await chrome.tabs.get(id, function () {
                if (chrome.runtime.lastError) {
                    reject(`tab doesn't exist: ${chrome.runtime.lastError.message}`)
                }
            })
            chrome.tabs.onRemoved.addListener(tabRemoval)
        }

        let messageReceived = function (request, sender, reply) {

            if (sender.tab && sender.tab.id == id) {
                if (!cFn || (cFn && cFn(request, sender, reply))) { // only stop listening if a callback function is defined and returns true or if it isn't defined

                    console.log("successfully exchanged message")

                    chrome.tabs.onRemoved.removeListener(tabRemoval)
                    chrome.runtime.onMessage.removeListener(arguments.callee)

                    resolve(request)
                }
            }
        }

        chrome.runtime.onMessage.addListener(messageReceived)
    })

let saveData = async (fileName, data) => {

    console.log(`Saving ${fileName}...`)
    let id = (await chrome.tabs.create({ url: chrome.runtime.getURL("reporter/reporter.html") })).id

    await waitForResponse((request, sender, reply) => {

        if (request["type"] == "downloader") {
            console.log("sending data to download...")

            reply({ "name": fileName, "data": data })
            return true
        }
        return false
    }, id)

    await waitForResponse((request, reply) => request["type"] == "downloader", id)
}

let scrape = async (contents, history, maxTabs) => {

    // store states
    let failure = {}
    let success = []
    let currentlyRunning = {}

    if (history) {
        console.log("Entries before: ", contents.length)
        contents = contents.filter(a => !history.some(b => a[0] == b))
        console.log("Entries after: ", contents.length)
    }

    scraping = true

    for (let i = 0; i < contents.length; i++) {

        if (scraping == false) { break } // allow for user to stop scraping

        // if more that the maxTabs are running at once then wait for one to finish before continuing
        if (Object.keys(currentlyRunning).length >= maxTabs) {

            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)

            console.log("Continue")
        }

        let name = contents[i][0]
        let url = contents[i][1]

        console.log(name, url)

        // jesus, javascript is funky - what the hell's the context here?! Even I don't get what I've written!
        currentlyRunning[name] = new Promise(async (resolve, reject) => {
            try {

                let id = (await chrome.tabs.create({ url: url })).id
                console.log("waiting for status request")

                await waitForResponse((request, sender, reply) => {
                    if (request["type"] == "scrape") {

                        reply(name)
                        return true
                    }
                    return false
                }, id)

                console.log("and we're off!")

                await waitForResponse((request, sender, reply) => { // store our promise in here but don't wait for it here

                    if (request["type"] == "error") { // must listen for reply here to avoid race condition
                        console.log("got reply from", request["name"])

                        if (request["type"] == "error") {

                            if (request["error"] && request["error"].length > 0) {
                                failure[request["name"]] = request["error"]
                                console.log("error from backend: ", request["error"])

                                reply({ "received": true })

                            } else {
                                success.push(request["name"])
                            }
                        }

                        console.log("finished with ", request["name"])

                        delete currentlyRunning[request["name"]] // finished!
                        return true
                    }
                }, id)

                resolve()

            } catch (error) {

                console.log("ERROR", error)
                failure[name] = `failed to load tab, error: ${error}`

                delete currentlyRunning[name] // finished!
                reject(error)
            }
        })
    }

    console.log("waiting for all downloads to finish")
    await Promise.allSettled(Object.values(currentlyRunning)).catch() // ignore errors, even if all were rejected

    console.log(failure)

    await Promise.allSettled([
        saveData("progress.txt", JSON.stringify(success)),
        saveData("errors.txt", JSON.stringify(failure))
    ])

    console.log("WE FINISHED BOI!")
    chrome.runtime.reload() // much easier this way
}