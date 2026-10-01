document.addEventListener("DOMContentLoaded", () => {
    const saveBtn = document.getElementById("saveBtn");
    const btnIcon = document.getElementById("btnIcon");
    const btnText = document.getElementById("btnText");
    const statusBox = document.getElementById("statusBox");
    const resultBox = document.getElementById("resultBox");
    const resTitle = document.getElementById("resTitle");
    const resCategory = document.getElementById("resCategory");
    const openDashboardBtn = document.getElementById("openDashboardBtn");

    function setStatus(type, message) {
        statusBox.className = `status-box ${type}`;
        statusBox.innerText = message;
        statusBox.classList.remove("hidden");
    }

    function clearStatus() {
        statusBox.classList.add("hidden");
    }

    openDashboardBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: "http://localhost:8080/" });
    });

    saveBtn.addEventListener("click", () => {
        clearStatus();
        resultBox.classList.add("hidden");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                setStatus("error", "No active tab found.");
                return;
            }

            const activeTab = tabs[0];
            const url = activeTab.url || "";

            // Check for restricted URLs
            if (url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:") || url.startsWith("chrome-extension://")) {
                setStatus("error", "Cannot capture system or extension pages.");
                return;
            }

            // Set loading state
            saveBtn.disabled = true;
            btnIcon.innerText = "⏳";
            btnText.innerText = "Saving with AI...";
            setStatus("info", "Extracting webpage and generating AI summary...");

            chrome.tabs.sendMessage(activeTab.id, { action: "extract" }, (response) => {
                saveBtn.disabled = false;
                btnIcon.innerText = "💾";
                btnText.innerText = "Save Current Page";

                if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError);
                    setStatus("error", "Please refresh the page and try again (content script was not loaded).");
                    return;
                }

                if (response && response.success) {
                    setStatus("success", "✅ Successfully saved to Knowledge OS!");

                    const doc = response.data;
                    resTitle.innerText = doc.aiTitle || doc.originalTitle || "Page Saved";
                    resCategory.innerText = "📂 " + (doc.category || "General");
                    resultBox.classList.remove("hidden");
                } else {
                    const err = response ? response.error : "Server unreachable at localhost:8080";
                    setStatus("error", "Error: " + err);
                }
            });
        });
    });
});