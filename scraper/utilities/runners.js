let currentlyRunning = {}

let scrape = async (contents, success, maxConcurrentPages, maxPageCount, resolution) => {

    // store states
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
    closerGen(null, async () => { // where does this run? The great Hamdan chasm (look into it, pretty cool how it works)
        stop = true // I can't just return else errors.txt (if built) won't be downloaded
        Object.keys(currentlyRunning).forEach(runningTabId => {
            delete currentlyRunning[runningTabId]
            chrome.tabs.remove(parseInt(runningTabId), null).catch((e) => null)
        })
    })

    for (let i = 0; i < contents.length; i++) {
        // if more that the maxTabs are running at once then wait for one to finish before continuing
        if (Object.keys(currentlyRunning).length >= maxConcurrentPages) {

            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)
        }

        if (stop) { break }

        let name = contents[i][0]
        let url = contents[i][1]

        let tab = await chrome.tabs.create({ url: url })
            .catch(e => {
                console.log("Failed to create tab")
                failure[name] = `failed to create tab: ${e}`
            })

        if (!tab) { continue }

        let id = tab.id

        // jesus, javascript is funky - what the hell's the context here?! Even I don't get what I've written!
        currentlyRunning[tab.id] = new Promise(async (resolve, reject) => {
            try {
                console.log("waiting for status request from", name, url, id)

                await waitForResponse(id, (request, sender, reply) => {
                    if (request["type"] == "document") {

                        reply({ "type": "scraper", "name": name, resolution, maxPageCount })
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

                        delete currentlyRunning[id] // finished!
                        return true
                    }
                })

                resolve()

            } catch (error) {
                if (currentlyRunning[id]) { // do I still exist?

                    console.log("ERROR", error)
                    failure[name] = `failed to load tab, error: ${error}`

                    delete currentlyRunning[id] // finished!
                    reject(error)
                }

                resolve()
            }
        })
    }

    console.log("waiting for all downloads to finish")
    await Promise.allSettled(Object.values(currentlyRunning)).catch() // ignore errors, even if all were rejected

    if (Object.keys(failure).length > 0) {
        console.log(failure)
        await saveData("errors.txt", JSON.stringify(failure))
    }

    console.log("WE FINISHED BOI!")
    await alertBridge("Dundo!")

    chrome.runtime.reload() // much easier this way
}

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