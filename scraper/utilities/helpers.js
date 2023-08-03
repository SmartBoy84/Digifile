let getWait = (d) => new Promise(resolve => setTimeout(resolve, d))
let getRandom = (low, high) => Math.floor(low + (Math.random() * (high - low)))

let saveData = async (fileName, data) => await openReporter("download", { "name": fileName, "data": data })
let alertBridge = async (str) => await openReporter("alert", { "alert": str })

let myWindow = {}
let getWindow = async () => {
    if (!myWindow.id) {
        myWindow.id = (await chrome.windows.create({
            focused: true,
            state: 'maximized'
        })
        ).id

        myWindow.windowPromise = new Promise(resolve => myWindow.windowResolver = () => resolve(null))
    }
    return myWindow.id
}

let windowCloseBlocker = async () => {
    let closed = false

    if (myWindow.id) {

        try {
            await chrome.windows.get(myWindow.id)
        } catch (e) {
            closed = true
        }

        // I have to do this because the code tries to make another tab even as the window is being closed
        if (closed) {
            console.log("tab waiting for complete window closure")
            await myWindow.windowPromise // send this back to delay further executation
        }
    }

    return closed
}

let createTab = async (url, anyWindow) => {
    if (!anyWindow && await windowCloseBlocker()) {
        return null
    }

    return (await chrome.tabs.create({
        ...{ url, active: true },
        ...anyWindow ? {/* any window */ } : { windowId: await getWindow() }
    })).id
}

let waitForResponse = (id, cFn) =>
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

let closerGen = (message, cFn) => {
    let listeners = [
        chrome.runtime.onMessage.addListener(async request => {
            if (request["type"] == "stop") {
                console.log("Close command received")
                await stop()
            }
        }),
        chrome.windows.onRemoved.addListener(async removedID => {
            console.log("Window closed")

            if (removedID == myWindow.id) {
                windowId = null
                await stop()
            }
        })]

    let stop = async () => {
        console.log("stopping...")

        // first and foremost - stop the runners ASAP
        await cFn()

        // next stop the listeners so we can close whatever without them firing
        listeners.forEach(listener => {
            chrome.runtime.onMessage.removeListener(listener)
            chrome.windows.onRemoved.removeListener(listener)
        })

        // delete from currently running array to prevent uncessary pollution of error after next step
        // no risk of new tabs opening due to my silly little trick above in createTab()
        Object.keys(currentlyRunning).forEach(runningTabId => delete currentlyRunning[runningTabId])

        // now close the window if it's still open
        if (myWindow.id) {
            chrome.windows.remove(myWindow.id) // this should also stop all running racers
            myWindow.id = null
        }
        myWindow.windowResolver()

        if (message) {
            alertBridge(message)
        }
    }

    return stop
}

let openReporter = async (type, data) => {
    try {
        let id = await createTab(chrome.runtime.getURL("reporter/reporter.html"), true)

        await waitForResponse(id, (request, sender, reply) => {

            if (request["type"] == "reporter") {
                console.log("sending data to reporter page...")

                reply({ "type": type, ...data })
                return true
            }
            return false
        })

        await waitForResponse(id, request => request["type"] == "reporter") // wait for tab to finish
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