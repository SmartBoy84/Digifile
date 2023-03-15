let id = null
let cancel = false

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {

    if (request["type"] == "contents") {
        scrape(request["contents"])
    }

    if (request["type"] == "cancel") {
        chrome.runtime.reload()
    }

    if (!sender.tab || sender.tab.id != id) { // so that pages can load as per usual if not in scraping mode
        reply("")
    }
    return true
})

let waitForResponse = async (cFn) =>
    await new Promise((resolve, reject) => {
        chrome.runtime.onMessage.addListener(function (request, sender, reply) {

            if (sender.tab && sender.tab.id == id) {

                resolve(request)
                chrome.runtime.onMessage.removeListener(arguments.callee)

                if (cFn) {
                    let rep = cFn(request)
                    console.log("sending reply", rep)
                    return reply(rep)
                }
            }
            return true
        })
    })

let saveData = async (fileName, data) => {

    console.log("Saving data...")
    id = (await chrome.tabs.create({ url: chrome.runtime.getURL("reporter/reporter.html") })).id

    await waitForResponse((request) => {
        if (request["type"] == "downloader") {
            console.log("sending data to download...")
            return { "name": fileName, "data": data }
        }
    })
}

let scrape = async (contents) => {
    let failure = {}
    // await saveData("errors.txt", JSON.stringify(failure))

    for (let i = 0; i < contents.length; i++) {
        if (cancel) {
            id = null
            cancel = false
            return
        }

        let name = contents[i][0].replaceAll("\/", `$$$$`).replace(/\.[^/.]+$/, ".pdf")
        let url = contents[i][1]

        let error = await downloadPage(name, url)
        if (error != "") {
            console.log(`error: ${error}`)
            failure[name] = error

        }
        console.log("moving on")
    }

    await saveData("errors.txt", JSON.stringify(failure))
    console.log("WE FINISHED BOI!")
}

let downloadPage = async (name, url) => {

    scraping = true
    console.log(name, url)

    id = (await chrome.tabs.create({ url: url })).id
    console.log("waiting for status request")

    await waitForResponse((request) => request["type"] == "scrape" ? name : "")
    console.log("and we're off!")

    // page has been loaded, wait for download to finish - tab should report any errors
    while (true) {
        let status = await waitForResponse()

        if (status["type"] == "error") {
            console.log("finished downloading")

            return status["error"]
        }
    }
}