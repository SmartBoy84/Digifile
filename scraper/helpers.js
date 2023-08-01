let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))
let getRandom = (low, high) => Math.floor(low + (Math.random() * (high - low)))

let saveData = async (fileName, data) => await openReporter("download", { "name": fileName, "data": data })
let alertBridge = async (str) => await openReporter("alert", { "alert": str })

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

let injectCode = (hook, tabId) => {
    console.log("Injecting code!")

    chrome.scripting.executeScript({
        target: { tabId },
        func: code => {
            console.log("Injecting alert hooker!")

            const el = document.createElement('script');
            el.textContent = code;
            (document.head || document.documentElement).appendChild(el);
            // el.remove();
        },
        args: [hook],
        world: 'MAIN',
        injectImmediately: true, // Chrome 102+
    })
} 