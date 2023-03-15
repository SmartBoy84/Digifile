window.addEventListener("DOMContentLoaded", async () => {
    console.log("Loaded!")
    await new Promise(resolve => setTimeout(resolve, 1000))

    let command = await chrome.runtime.sendMessage({ "type": "downloader" })

    let data = command["data"]
    let fileName = command["name"]

    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    window.close()
})