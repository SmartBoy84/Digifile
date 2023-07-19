let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))
let getRandom = (low, high) => Math.floor(low + (Math.random() * (high - low)))

let saveData = async (fileName, data) => await openReporter("download", { "name": fileName, "data": data })
let alertBridge = async (str) => await openReporter("alert", { "alert": str })

let currentlyRunning = {}

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
    // "maxPages": 3, // max number of concurrent pages
    // "minTime": 30, // min
    // "maxTime": 50, // min
    // "scrollAmount": 200, // px
    // "scrollSpeed": 200 // ms

    if (request["type"] == "document") {
        if (!currentlyRunning[sender.tab.id]) {
            console.log("creating standard page context")
            reply({ "type": "normal" })
        }
    }

    if (request["type"] == "contents") {
        console.log("max pages", request["maxPages"])
        console.log(request)
        scrape(request["contents"], request["history"], request["maxPages"])
    }

    if (request["type"] == "roam") {
        console.log(request)
        roam(request["contents"], request["maxPages"], request["minTime"], request["maxTime"], request["scrollSpeed"], request["scrollStride"])
    }
})

let waitForResponse = (id, cFn) =>
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

        await waitForResponse(id, (request, sender, reply) => {

            if (request["type"] == "reporter") {
                console.log("sending data to reporter page...")

                reply({ "type": type, ...data })
                return true
            }
            return false
        })

        await waitForResponse(id, (request, reply) => request["type"] == "reporter") // wait for tab to finish
        await chrome.tabs.remove(id, null)

    } catch (error) {
        console.log(error)
    }
}

let closerGen = (message, cFn) => new Promise((masterResolve, reject) => {
    chrome.runtime.onMessage.addListener(async function (request, sender, reply) {
        if (request["type"] == "stop") {

            console.log("stopping...")
            alertBridge(message)

            chrome.runtime.onMessage.removeListener(arguments.callee)

            masterResolve()
            cFn()
        }
    })
})

let roam = async (contents, maxTabs, min, max, scrollSpeed, scrollStride) => {
    let stop = false

    closerGen("Welcome back!", async () => {
        stop = true

        for (let id of Object.keys(currentlyRunning)) {
            await chrome.tabs.remove(parseInt(id), null)
        }
    })

    while (true) {

        if (Object.keys(currentlyRunning).length == maxTabs) {
            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)
        }

        if (stop) { break }

        let id = (await chrome.tabs.create({ url: contents[getRandom(0, contents.length - 1)][1] })).id
        currentlyRunning[id] = new Promise(async (resolve, reject) => {

            try {
                await waitForResponse(id, (request, sender, reply) => {
                    if (request["type"] == "document") {

                        reply({ "type": "traveller", "time": getRandom(min, max) * 60 * 1000, "scrollSpeed": scrollSpeed * 1000, "scrollStride": scrollStride })
                        return true
                    }
                    return false
                })

                await waitForResponse(id) // wait for tab to timeout or be closed, throw regardless of status
            }
            catch (error) {
                console.log(error)

                await chrome.tabs.remove(id, null).catch((e) => null)
                delete currentlyRunning[id]
                resolve()
            }
        })
    }
}

let scrape = async (contents, success, maxTabs) => {

    // store states
    let currentlyRunning = {}
    let failure = {}

    if (success) {
        console.log("Entries before: ", contents.length)

        contents = contents.filter(a => !success.some(b => a[0] == b))
        if (contents.length == 0) {
            alertBridge("Archive is already up to data - nothing new to scrape!")
            return
        } else {
            await alertBridge(`About to scrape ${contents.length} files, ready?`)
        }

        console.log("Entries after: ", contents.length)
    }

    let stop = false
    closerGen("Let me finish these final few documents, please - then I'll stop and generate a progress report :)", async () => stop = true)

    for (let i = 0; i < contents.length; i++) {

        // if more that the maxTabs are running at once then wait for one to finish before continuing
        if (Object.keys(currentlyRunning).length >= maxTabs) {

            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)
        }

        if (stop) { break }

        let name = contents[i][0]
        let url = contents[i][1]

        console.log(name, url)

        // jesus, javascript is funky - what the hell's the context here?! Even I don't get what I've written!
        currentlyRunning[name] = new Promise(async (resolve, reject) => {
            try {

                let id = (await chrome.tabs.create({ url: url })).id
                console.log("waiting for status request")

                await waitForResponse(id, (request, sender, reply) => {
                    if (request["type"] == "document") {

                        reply({ "type": "scraper", "name": name })
                        return true
                    }
                    return false
                })

                console.log("and we're off!")

                await waitForResponse(id, (request, sender, reply) => { // store our promise in here but don't wait for it here

                    if (request["type"] == "error") { // must listen for reply here to avoid race condition
                        console.log("got reply from", request["name"])

                        if (request["type"] == "error") {

                            if (request["error"] && request["error"].length > 0) {
                                failure[request["name"]] = request["error"]
                                console.log("error from backend: ", request["error"])

                                reply({ "received": true })

                            }
                        }

                        console.log("finished with ", request["name"])

                        delete currentlyRunning[request["name"]] // finished!
                        return true
                    }
                })

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

    if (Object.keys(failure) > 0) {
        await Promise.allSettled([
            saveData("errors.txt", JSON.stringify(failure))
        ])
    }

    console.log("WE FINISHED BOI!")
    chrome.runtime.reload() // much easier this way
}