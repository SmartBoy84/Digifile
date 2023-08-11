let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))
let getRandom = (low, high) => Math.floor(low + (Math.random() * (high - low)))

let saveData = async (fileName, data) => await dashboardMessage({ "type": "download", "name": fileName, "data": data })
let alertBridge = async (str) => await awaitTabResponse(await createTab("./dashboard/alert/alert.html", true), (request, sender, reply) => reply({ "data": str })).catch(e => null)

let awaitFrameResponse = (id, cFn) =>

    new Promise(async (resolve, reject) => {
        let monitorPort = await chrome.runtime.connect(null, { "name": id })

        let frameRemoval = async function (tabId) {
            if (tabId == id) {
                monitorPort.onRemoved.removeListener(arguments.callee)
                console.log("frame closed")

                if (await windowCloseBlocker()) {
                    resolve() // tab was closed indirectly because of user closing window not the tab itself
                }
                else {
                    reject("frame closed")
                }
            }
        }

        monitorPort.onRemoved.addListener(frameRemoval)

        let messageReceived = function (request, sender, reply) {

            if (sender["id"] && sender["id"] == id) {
                if (!cFn || (cFn && cFn(request, sender, reply))) { // only stop listening if a callback function is defined and returns true or if it isn't defined

                    console.log("successfully exchanged message")

                    monitorPort.onRemoved.removeListener(tabRemoval)
                    chrome.runtime.onMessage.removeListener(arguments.callee)

                    resolve(request)
                }
            }
        }

        chrome.runtime.onMessage.addListener(messageReceived)
    })

let awaitTabResponse = (id, cFn) =>
    new Promise(async (resolve, reject) => {

        let tabRemoval = async function (tabId) {
            if (tabId == id) {
                chrome.tabs.onRemoved.removeListener(arguments.callee)
                console.log("tab closed")

                if (await windowCloseBlocker()) {
                    resolve() // tab was closed indirectly because of user closing window not the tab itself
                }
                else {
                    reject("tab closed")
                }
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

let getDigifyTabs = async () => await chrome.tabs.query({ url: "https://digify.com/*" })

let getSelectedPaths = async () => {
    let digifyTabs = await getDigifyTabs()

    for (tab of digifyTabs) { // won't error as all digify pages are expected to have this listener (url above matches the one in the manifest)
        let reply = await chrome.tabs.sendMessage(tab.id, { "type": "selection" })

        if (reply["paths"] && reply["paths"].length > 0) {
            return reply["paths"]
        }
    }

    return []
}