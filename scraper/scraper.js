let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

let scraping = false

let alertBridge = (str) => chrome.runtime.sendMessage({ "type": "alert", "message": str })

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {

    if (request["type"] == "contents") {
        scrape(request["contents"], request["history"])
    }

    if (request["type"] == "pause") {
        scraping = false
    }

})

let waitForResponse = (cFn, ...idList) =>
    new Promise((resolve, reject) => {

        let error = (str) => resolve({ "failed": true, "error": str })

        let tabRemoval = function (tabId, removeInfo) {
            if (idList.includes(tabId)) {
                console.log("tab closed!", tabId)

                chrome.tabs.onRemoved.removeListener(arguments.callee)
                error("tab closed")
            }
        }

        let messageReceived = function (request, sender, reply) {

            if (sender.tab && idList.includes(sender.tab.id)) {
                if (!cFn || (cFn && cFn(request, sender, reply))) { // only stop listening if a callback function is defined and returns true or if it isn't defined

                    console.log("successfully exchanged message")

                    chrome.tabs.onRemoved.removeListener(tabRemoval)
                    chrome.runtime.onMessage.removeListener(arguments.callee)

                    resolve(request)
                }
            }
        }

        if (idList) {
            for (let id of idList) { // ensure that tab exists

                chrome.tabs.get(id, function () {
                    if (chrome.runtime.lastError) {

                        console.log("tab doesn't exist!", chrome.runtime.lastError.message)
                        error("tab doesn't exist")
                    }
                })
                chrome.tabs.onRemoved.addListener(tabRemoval)
            }
        }
        chrome.runtime.onMessage.addListener(messageReceived)
    })

let saveData = async (fileName, data) => {

    console.log("Saving data...")
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

let maxConcurrent = 3 // if we have too many going at once then printing takes longer than our hardcoded timout value

let scrape = async (contents, history) => {

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

        // if more that the maxConcurrent are running at once then wait for one to finish before continuing
        if (Object.keys(currentlyRunning).length >= maxConcurrent) {

            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.any(Object.values(currentlyRunning))

            console.log("Continue")
        }

        let name = contents[i][0]
        let url = contents[i][1]

        console.log(name, url)

        try {
            let id = (await chrome.tabs.create({ url: url })).id

            console.log("waiting for status request")

            // jesus, javascript is funky - what the hell's the context here?! Even I don't get what I've written!
            currentlyRunning[name] = new Promise(async (resolve, reject) => {
                try {

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
                                    console.log("error: ", request["error"])

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

                } catch (error) { reject(error) } // unfortunately two try catches needed because js problems (actually valid design faults on my part but let's blame js instead!)
            })
        } catch (error) {
            console.log(`error: ${error}`)

            failure[name] = `failed to load tab, error: ${error}`
            delete currentlyRunning[request["name"]] // finished!
        }
    }

    console.log("waiting for all downloads to finish")
    await Promise.allSettled(Object.values(currentlyRunning))

    console.log(failure)

    await saveData("progress.txt", JSON.stringify(success)) // we don't need to track errors
    await saveData("errors.txt", JSON.stringify(failure))

    console.log("WE FINISHED BOI!")
    chrome.runtime.reload() // much easier this way
}