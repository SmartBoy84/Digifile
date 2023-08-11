window.addEventListener("DOMContentLoaded", async () => {

    try {
        let reply = await chrome.runtime.sendMessage({ "type": "alert" })
        alert(reply["data"])
    } catch (error) {
        alert(error)
    }
    window.close()
})