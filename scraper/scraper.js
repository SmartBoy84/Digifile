try {
    importScripts('./utilities/helpers.js', './utilities/runners.js');
} catch (e) {
    console.error(e);
}

let override = `
(function() {
    window.alert = function(str) {
        var data = { type: "alert_message", text: str };
        window.postMessage(data, "*");
    };
})();
`

chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
    // "maxPages": 3, // max number of concurrent pages
    // "minTime": 30, // min
    // "maxTime": 50, // min
    // "scrollAmount": 200, // px
    // "scrollSpeed": 200 // ms
    try {
        if (request["type"] == "document") {

            if (!currentlyRunning[sender.tab.id]) {
                console.log("creating standard page context", currentlyRunning, sender.tab.id)
                injectCode(override, sender.tab.id) // ovveride alerts to prevent unwanted termination of code exec

                reply({ "type": "normal" })
            }
        }

        if (request["type"] == "roam") {
            console.log(request)
            roam(request["contents"], request["maxConcurrentPages"], request["minTime"], request["maxTime"], request["scrollSpeed"], request["scrollStride"], request["heirarchy"])
        }

        if (request["type"] == "contents") {
            console.log(request)

            let selection = await getSelectedPaths()
            if (selection.length > 0) {
                console.log("selection", selection)

                request["contents"] = request["contents"].filter(a => selection.some(b => a[0].includes(b.replace(/\.[^/.]+$/, "")))) // * remove extension from selection

                if (request["contents"].length == 0) {
                    alertBridge(`Selection made but ${selection} not found in this excel sheet; remove selection, close tab or update excel sheet`)
                    return
                }

                await alertBridge("Specific files/folders selected, filtering file directory")
            }

            if (request["history"]) {
                console.log("Entries before: ", request["contents"].length, request["contents"])

                request["contents"] = request["contents"].filter(a => !request["history"].some(b => a[0] == b))
                if (request["contents"].length == 0) {
                    alertBridge("Archive is already up to data - nothing new to scrape!")
                    return
                }

                console.log("Entries after: ", request["contents"].length, request["contents"])
            }

            await alertBridge(`About to scrape ${request["contents"].length} files, ready?`)
            scrape(request["contents"], request["maxConcurrentPages"], request["maxPageCount"], request["resolution"])
        }
    } catch (error) {
        console.log(error)
        await alertBridge(String(error))
    }
})