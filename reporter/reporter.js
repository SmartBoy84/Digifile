window.addEventListener("DOMContentLoaded", async () => {
    console.log("Loaded!")

    let command = await chrome.runtime.sendMessage({ "type": "downloader" })

    let data = command["data"]
    let fileName = command["name"]

    var a = document.createElement("a");
    var file = new Blob([data], { type: "text/plain" });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();

    window.close()
})