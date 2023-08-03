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

    if (request["type"] == "document") {

        if (!currentlyRunning[sender.tab.id]) {
            console.log("creating standard page context", currentlyRunning, sender.tab.id)
            injectCode(override, sender.tab.id) // ovveride alerts to prevent unwanted termination of code exec

            reply({ "type": "normal" })
        }
    }

    if (request["type"] == "contents") {
        console.log("max pages", request["maxConcurrentPages"])
        console.log(request)
        scrape(request["contents"], request["history"], request["maxConcurrentPages"], request["maxPageCount"], request["resolution"])
    }

    if (request["type"] == "roam") {
        console.log(request)
        roam(request["contents"], request["maxConcurrentPages"], request["minTime"], request["maxTime"], request["scrollSpeed"], request["scrollStride"])
    }
})