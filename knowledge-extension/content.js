chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract") {
        let extractedText = document.body ? document.body.innerText : "";
        extractedText = extractedText.replace(/\s+/g, " ").trim();

        // Limit content to 15,000 characters to prevent huge payloads while preserving ample context
        if (extractedText.length > 15000) {
            extractedText = extractedText.substring(0, 15000);
        }

        const page = {
            title: document.title || window.location.hostname,
            url: window.location.href,
            website: window.location.hostname,
            content: extractedText
        };

        fetch("http://localhost:8080/api/webpage/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(page)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(
                    err => { throw new Error(err.error || `Server error ${response.status}`); },
                    () => { throw new Error(`Server error ${response.status}`); }
                );
            }
            return response.json();
        })
        .then(data => {
            console.log("Knowledge OS: Saved Successfully", data);
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("Knowledge OS Save Error:", error);
            sendResponse({ success: false, error: error.message || "Failed to connect to Knowledge OS server" });
        });

        // Return true to indicate asynchronous response
        return true;
    }
});