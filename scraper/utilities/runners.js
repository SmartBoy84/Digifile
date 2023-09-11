let currentlyRunning = {}

let scrape = async (contents, maxConcurrentPages, maxPageCount, resolution) => {

    // store states
    let failure = {}
    currentlyRunning = {}

    // where does this run? The great Hamdan chasm (look into it, pretty cool how it works)
    let stop = false
    let manualStopper = closerGen(null, async () => stop = true) // I can't just return else errors.txt (if built) won't be downloaded

    for (let i = 0; i < contents.length; i++) {
        // if more that the maxTabs are running at once then wait for one to finish before continuing
        if (Object.keys(currentlyRunning).length >= maxConcurrentPages) {

            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)
        }

        if (stop) { break }

        let name = contents[i][0]
        let url = contents[i][1]

        let id
        try { id = await createTab(url) }
        catch (e) {
            console.log("Failed to create tab", url)
            failure[name] = `failed to create tab: ${e}`
        }

        if (!id) { continue } // it may be that the race is finished

        // jesus, javascript is funky - what the hell's the context here?! Even I don't get what I've written!
        currentlyRunning[id] = new Promise(async (resolve, reject) => {
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
    await Promise.allSettled(Object.values(currentlyRunning)).catch(e => null) // ignore errors, even if all were rejected

    if (Object.keys(failure).length > 0) {
        console.log(failure)
        await saveData("errors.txt", JSON.stringify(failure))
    }

    console.log("WE FINISHED BOI!")
    await alertBridge("Dundo!")

    manualStopper()
}

let roam = async (contents, maxTabs, min, max, scrollSpeed, scrollStride) => {

    currentlyRunning = {}

    let stop = false
    let manualStopper = closerGen("Welcome back!", async () => stop = true)

    while (true) {

        if (Object.keys(currentlyRunning).length == maxTabs) {
            console.log("Reached capacity! Waiting for one to finish...")
            await Promise.race(Object.values(currentlyRunning)).catch(e => null)
        }

        if (stop) { break }

        let id = await createTab(contents[getRandom(0, contents.length - 1)][1])
        if (!id) { continue }

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

                delete currentlyRunning[id]
                resolve()
            }
        })
    }

    manualStopper()
}