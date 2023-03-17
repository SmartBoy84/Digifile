let scraping = false // ugh, global variable needed to catch scraper routine

let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))

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

let openReporter = async (type, data) => {
    try {
        let id = (await chrome.tabs.create({ url: chrome.runtime.getURL("reporter/reporter.html") })).id

        await waitForResponse((request, sender, reply) => {

            if (request["type"] == "reporter") {
                console.log("sending data to reporter page...")

                reply({ "type": type, ...data })
                return true
            }
            return false
        }, id)

        await waitForResponse((request, reply) => request["type"] == "reporter", id) // wait for tab to finish
        await chrome.tabs.remove(id, null)

    } catch (error) {
        console.log(error)
    }
}

let saveData = async (fileName, data) => await openReporter("download", { "name": fileName, "data": data })
let alertBridge = async (str) => await openReporter("alert", { "alert": str })

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {

    if (request["type"] == "contents") {
        console.log("max", request["concurrent"])
        scrape(request["contents"], request["history"], request["concurrent"])
    }

    if (request["type"] == "pause") {
        scraping = false
    }
})

let scrape = async (contents, history = [], maxTabs) => {

    // store states
    let failure = {}
    let currentlyRunning = {}

    if (history) {
        console.log("Entries before: ", contents.length)

        contents = contents.filter(a => !history.some(b => a[0] == b))
        if (contents.length == 0) {
            alertBridge("archive already up to data, nothing new to scrape!")
            scraping = false
            return
        }

        console.log("Entries after: ", contents.length)
    }

    scraping = true

    for (let i = 0; i < contents.length; i++) {

        if (scraping == false) { break } // allow for user to stop scraping

        // if more that the maxTabs are running at once then wait for one to finish before continuing
        if (Object.keys(currentlyRunning).length >= maxTabs) {

            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)
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

                            }

                            history.push(request["name"]) // due to the nature of all this, I can't afford to save a dummy file and not count it as a success, ya know?
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
        saveData("progress.txt", JSON.stringify(history)),
        saveData("errors.txt", JSON.stringify(failure))
    ])

    console.log("WE FINISHED BOI!")
    chrome.runtime.reload() // much easier this way
}