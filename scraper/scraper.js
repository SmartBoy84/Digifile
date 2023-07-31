try {
    importScripts('./helpers.js', './runners.js');
} catch (e) {
    console.error(e);
}

let override = `
(function() {
    window.alert = function(str) {
        var data = { type: "alert_message", text: str };
        window.postMessage(data, "*");
    };

    var _old_print = window.printPDF;
    window.printPDF = function() {
        let error = "."
        let actual = console.error;
        console.error = function(...args) {
            error += args.join(" ")
          };
        _old_print()
        var data = { type: "print", text: error };
        window.postMessage(data, "*");

        console.error = actual
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
        console.log("Injecting alert hooker!")

        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            func: code => {
                console.log("Injecting alert hooker!")

                const el = document.createElement('script');
                el.textContent = code;
                (document.head || document.documentElement).appendChild(el);
                // el.remove();
            },
            args: [override],
            world: 'MAIN',
            injectImmediately: true, // Chrome 102+
        })

        if (!currentlyRunning[sender.tab.id]) {
            console.log("creating standard page context", currentlyRunning, sender.tab.id)
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