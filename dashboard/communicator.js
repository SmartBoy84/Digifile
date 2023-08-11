let windows = {}

// I've decided this will be the ultimate closer
// I could've chosen this function to be in the actual page, in the scraper script etc but realised it would work best here
let closeWindow = (id) => {
    windows[id].frame.remove()
    chrome.runtime.onConnect.removeListener(windows[id].pulse)
    delete windows[id]
}

let getNewId = () => {
    let spareId = Object.keys(windows).find((id, index, ids) => ids[index + 1] - id > 1) // see if there is an id spare somewhere within
    return spareId ? parseInt(spareId) + 1 // apparently the one after is free
        : Object.keys(windows).length + 1 // otherwise just add the one after
}

let openWindow = async (link) => {
    let frame = document.createElement("div")
    frame.className = "frame"

    let id = getNewId()
    console.log(id)
    windows[id] = {}
    windows[id]["frame"] = frame

    let iframe = document.createElement("iframe")
    iframe.src = link
    frame.appendChild(iframe)

    let closer = document.createElement("button")
    closer.className = "close"
    closer.innerHTML = "close"
    frame.appendChild(closer)

    closer.addEventListener("click", () => closeWindow(id))

    document.body.appendChild(frame)
    windows[id]["pulse"] = await chrome.runtime.onConnect.addListener(port => {
        if (String(port.name) != String(id)) {
            port.disconnect() // refuse connection in this case
        }
        console.log("Connection established")
    })
}

openWindow("./test.html")
openWindow("./test.html")
openWindow("./test.html")

window.addEventListener("DOMContentLoaded", async () => {

    try {
        await chrome.runtime.sendMessage({ "type": "dashboard" })

        chrome.runtime.onMessage.addListener(async (request, sender, reply) => {
            let data = {}

            if (request["type"] == "frame") {
                data["id"] = await openWindow(request["url"])
            }

            if (request["type"] == "download") {

                let data = request["data"]
                let fileName = request["name"]

                var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
                var downloadAnchorNode = document.createElement('a');

                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", fileName);
                document.body.appendChild(downloadAnchorNode); // required for firefox

                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            }

            reply({ "type": "dashboard", ...data })
        })
    } catch (error) {
        alert(error)
        window.close()
    }
})