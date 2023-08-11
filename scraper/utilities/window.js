let myWindow = {}
let getWindow = async (closingMessage, cFn) => {
    if (!myWindow.id) {
        myWindow.id = (await chrome.windows.create({
            focused: true,
            state: 'maximized'
        })
        ).id

        myWindow.windowPromise = new Promise(resolve => myWindow.windowResolver = () => resolve(null))

        console.log("waiting for dashboard to respond")
        myWindow.dashboardId = await createTab("dashboard/dashboard.html")
        await awaitTabResponse(myWindow.dashboardId) // create dashboard and wait for it to respond

        myWindow.close = closerGen(closingMessage, cFn)

        console.log("Window created")
    }

    return myWindow.id
}

let closeWindow = async () => await myWindow.close()

let dashboardMessage = async (data) => {
    try {
        await chrome.tabs.sendMessage(myWindow.dashboardId, data)
        await awaitTabResponse(myWindow.dashboardId, request => request["type"] == "dashboard") // wait for tab to finish

    } catch (error) {
        console.log(error)
    }
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

let createFrame = async url => {
    if (await windowCloseBlocker()) {
        return null
    }

    let reply = await dashboardMessage({ "type": "frame", "url": url })
    return reply["id"]
}

let closerGen = (closingMessage, cFn) => {
    console.log("Creating closer")

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
        console.log("stopping...", closingMessage)

        // first and foremost - stop the runners ASAP
        if (cFn) {
            await cFn()
        }

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

        if (closingMessage) {
            alertBridge(closingMessage)
        }
    }

    return stop
}