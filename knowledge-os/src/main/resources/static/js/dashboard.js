let allDocuments = [];
let activeCategoryFilter = null;
let activeTypeFilter = 'All';

// ==========================
// Initialization
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initKeyboardShortcuts();
    initDropzone();
    loadDashboardData();
    initializeSearch();
});

// ==========================
// Theme Management (Light / Dark)
// ==========================
function initTheme() {
    const savedTheme = localStorage.getItem("kos_theme") || "dark";
    setTheme(savedTheme);

    const toggleBtn = document.getElementById("themeToggleBtn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme") || "dark";
            const next = current === "dark" ? "light" : "dark";
            setTheme(next);
        });
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kos_theme", theme);
    const icon = document.getElementById("themeIcon");
    if (icon) {
        if (theme === "dark") {
            icon.className = "bi bi-moon-stars-fill";
        } else {
            icon.className = "bi bi-sun-fill text-warning";
        }
    }
}

// ==========================
// Keyboard Shortcuts (⌘K / Ctrl+K)
// ==========================
function initKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            const searchBox = document.getElementById("searchBox");
            if (searchBox) searchBox.focus();
        }
    });
}

// ==========================
// Toast Notification
// ==========================
function showToast(message, isSuccess = true) {
    const toast = document.getElementById("knowledgeToast");
    const msg = document.getElementById("toastMsg");
    if (!toast || !msg) return;

    msg.innerText = message;
    const icon = toast.querySelector("i");
    if (icon) {
        icon.className = isSuccess ? "bi bi-check-circle-fill text-success" : "bi bi-exclamation-triangle-fill text-danger";
    }

    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

// ==========================
// Load Dashboard Data
// ==========================
async function loadDashboardData() {
    try {
        const [dashRes, docsRes] = await Promise.all([
            fetch("/api/dashboard"),
            fetch("/api/documents")
        ]);

        const dashData = await dashRes.json();
        const docsData = await docsRes.json();

        allDocuments = Array.isArray(docsData) ? docsData : (dashData.recentDocuments || []);

        loadStatistics(dashData, allDocuments);
        renderCategories(dashData.categoryStats || []);
        renderCategoryPills(dashData.categoryStats || []);
        applyCurrentFilters();
    } catch (err) {
        console.error("Error loading dashboard data:", err);
        const container = document.getElementById("recentDocuments");
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger text-center py-4 rounded-3">
                        <i class="bi bi-exclamation-triangle-fill fs-3 mb-2 d-block"></i>
                        Failed to connect to Knowledge OS backend. Please ensure the Spring Boot server is running on port 8080.
                    </div>
                </div>
            `;
        }
    }
}

// ==========================
// Statistics
// ==========================
function loadStatistics(dashData, docs) {
    const totalDocs = docs.length;
    document.getElementById("documents").innerText = totalDocs;
    document.getElementById("allBadge").innerText = totalDocs;

    const categoriesSet = new Set();
    let websiteCount = 0;
    let pdfCount = 0;

    docs.forEach(doc => {
        if (doc.sourceType === "Website") websiteCount++;
        else if (doc.sourceType === "PDF") pdfCount++;
        if (doc.category) categoriesSet.add(doc.category.trim());
    });

    document.getElementById("websiteCount").innerText = websiteCount;
    document.getElementById("pdfCount").innerText = pdfCount;
    document.getElementById("categories").innerText = categoriesSet.size;
}

// ==========================
// Categories & Pill Rails
// ==========================
function renderCategories(categories) {
    const categoryDiv = document.getElementById("categoryStats");
    if (!categoryDiv) return;

    categoryDiv.innerHTML = "";
    if (!categories || categories.length === 0) {
        categoryDiv.innerHTML = `<div class="p-2 text-muted small">No topics indexed yet.</div>`;
        return;
    }

    categories.forEach(cat => {
        if (!cat || !cat.category) return;
        const div = document.createElement("div");
        div.className = `category-chip-btn ${activeCategoryFilter === cat.category ? 'active' : ''}`;
        div.onclick = () => filterCategory(cat.category);
        div.innerHTML = `
            <span class="text-truncate me-2 small">📂 ${escapeHtml(cat.category)}</span>
            <span class="badge bg-secondary-subtle text-secondary rounded-pill">${cat.count}</span>
        `;
        categoryDiv.appendChild(div);
    });
}

function renderCategoryPills(categories) {
    const rail = document.getElementById("categoryPillsRail");
    if (!rail) return;

    rail.innerHTML = `
        <button class="pill-filter ${activeCategoryFilter === null ? 'active' : ''}" onclick="filterCategory('ALL')">
            <i class="bi bi-grid-fill me-1"></i> All Topics
        </button>
    `;

    (categories || []).forEach(cat => {
        if (!cat || !cat.category) return;
        const isActive = activeCategoryFilter === cat.category;
        const btn = document.createElement("button");
        btn.className = `pill-filter ${isActive ? 'active' : ''}`;
        btn.onclick = () => filterCategory(cat.category);
        btn.innerHTML = `
            <span>📂 ${escapeHtml(cat.category)}</span>
            <span class="badge bg-white text-dark rounded-pill ms-1 px-1 py-0" style="font-size: 0.65rem">${cat.count}</span>
        `;
        rail.appendChild(btn);
    });
}

function filterCategory(category) {
    if (category === 'ALL' || activeCategoryFilter === category) {
        activeCategoryFilter = null;
    } else {
        activeCategoryFilter = category;
    }
    // Update active state in sidebar and pills
    document.querySelectorAll(".category-chip-btn").forEach(el => {
        const name = el.querySelector("span")?.innerText?.replace("📂 ", "");
        el.classList.toggle("active", name === activeCategoryFilter);
    });
    loadDashboardData();
}

function filterType(type) {
    activeTypeFilter = type;

    document.querySelectorAll(".filter-item").forEach(el => el.classList.remove("active"));
    if (type === 'All') {
        document.getElementById("sidebarAll")?.classList.add("active");
    } else if (type === 'Website') {
        document.getElementById("sidebarWebsites")?.classList.add("active");
    } else if (type === 'PDF') {
        document.getElementById("sidebarPdfs")?.classList.add("active");
    } else if (type === 'MostRead') {
        document.getElementById("sidebarMostRead")?.classList.add("active");
    }

    applyCurrentFilters();
}

function applyCurrentFilters() {
    let filtered = [...allDocuments];

    if (activeTypeFilter === 'Website') {
        filtered = filtered.filter(doc => (doc.sourceType || "").toLowerCase() === 'website');
    } else if (activeTypeFilter === 'PDF') {
        filtered = filtered.filter(doc => (doc.sourceType || "").toLowerCase() === 'pdf');
    } else if (activeTypeFilter === 'MostRead') {
        filtered = filtered.filter(doc => (doc.visitCount || 0) > 0);
        filtered.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
    }

    if (activeCategoryFilter) {
        filtered = filtered.filter(doc => (doc.category || "").toLowerCase() === activeCategoryFilter.toLowerCase());
    }

    const keyword = (document.getElementById("searchBox").value || "").toLowerCase().trim();
    if (keyword) {
        filtered = filtered.filter(doc => {
            const title = (doc.aiTitle || doc.originalTitle || "").toLowerCase();
            const summary = (doc.summary || "").toLowerCase();
            const category = (doc.category || "").toLowerCase();
            const tags = (doc.tags || "").toLowerCase();
            const content = (doc.content || "").toLowerCase();
            return title.includes(keyword) || summary.includes(keyword) || category.includes(keyword) || tags.includes(keyword) || content.includes(keyword);
        });
    }

    const badge = document.getElementById("filterBadge");
    const heading = document.getElementById("listHeading");

    if (activeCategoryFilter || activeTypeFilter !== 'All' || keyword) {
        const parts = [];
        if (activeTypeFilter !== 'All') parts.push(activeTypeFilter);
        if (activeCategoryFilter) parts.push("Category: " + activeCategoryFilter);
        if (keyword) parts.push('"' + keyword + '"');

        badge.style.display = "inline-block";
        badge.innerText = `${filtered.length} results (${parts.join(", ")})`;
        heading.innerText = `Filtered Knowledge`;
    } else {
        badge.style.display = "none";
        heading.innerText = `📄 All Knowledge Base (${allDocuments.length})`;
    }

    renderDocuments(filtered);
}

// ==========================
// Search
// ==========================
function initializeSearch() {
    const searchBox = document.getElementById("searchBox");
    if (!searchBox) return;

    searchBox.addEventListener("input", () => {
        applyCurrentFilters();
    });
}

// ==========================
// Helper: Get Domain
// ==========================
function getDomain(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

// ==========================
// Render Document Cards (2026 Glassmorphism)
// ==========================
function renderDocuments(documents) {
    const recentDiv = document.getElementById("recentDocuments");
    recentDiv.innerHTML = "";

    if (!documents || documents.length === 0) {
        recentDiv.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="display-4 text-muted mb-3">🔍</div>
                <h5 class="fw-bold text-highlight">No Knowledge Records Found</h5>
                <p class="text-secondary small max-w-md mx-auto">
                    Try adjusting your search query or upload a PDF to expand your second brain.
                </p>
                <button class="btn btn-card-action primary mt-2" onclick="resetFilters()">
                    <i class="bi bi-arrow-repeat"></i> Reset All Filters
                </button>
            </div>
        `;
        return;
    }

    documents.forEach(doc => {
        const isPdf = doc.sourceType === "PDF";
        const title = escapeHtml(doc.aiTitle || doc.originalTitle || "Untitled Document");
        const category = escapeHtml(doc.category || "General");
        const summary = doc.summary ? escapeHtml(doc.summary) : "Summary processing or not available.";
        const domain = doc.sourceUrl ? getDomain(doc.sourceUrl) : (isPdf ? 'Local File' : 'Document');
        const visits = doc.visitCount || 0;

        let tagsHtml = "";
        if (doc.tags) {
            tagsHtml = doc.tags.split(",")
                .filter(t => t.trim().length > 0)
                .slice(0, 3)
                .map(tag => `<span class="tag-pill-modern">#${escapeHtml(tag.trim())}</span>`)
                .join("");
        }

        const safeTitle = title.replace(/'/g, "\\'");

        recentDiv.innerHTML += `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="knowledge-card-glass">
                    <div class="card-top-meta">
                        <div class="source-badge ${isPdf ? 'pdf' : 'website'}">
                            <i class="bi ${isPdf ? 'bi-file-earmark-pdf-fill' : 'bi-globe2'}"></i>
                            <span>${doc.sourceType || 'Article'}</span>
                        </div>
                        <div class="category-badge-glass text-truncate" style="max-width: 140px;" title="${category}">
                            ${category}
                        </div>
                    </div>

                    <h6 class="knowledge-title" title="${title}">
                        ${title}
                    </h6>

                    <p class="knowledge-summary">
                        ${summary}
                    </p>

                    <div class="mb-3 d-flex flex-wrap" style="min-height: 26px;">
                        ${tagsHtml}
                    </div>

                    <div class="card-footer-meta">
                        <span class="text-truncate me-2" style="max-width: 140px;">
                            <i class="bi bi-link-45deg"></i> ${domain}
                        </span>
                        <span>
                            <i class="bi bi-eye me-1"></i> <strong id="visit-${doc.id}">${visits}</strong> visits
                        </span>
                    </div>

                    <div class="card-actions-toolbar">
                        <button class="btn btn-card-action primary" onclick="handleOpenDoc(${doc.id})">
                            <i class="bi bi-box-arrow-up-right"></i> Open
                        </button>
                        <button class="btn btn-card-action" onclick="showSummary(${doc.id})">
                            <i class="bi bi-file-text"></i> Details
                        </button>
                        <button class="btn btn-card-action" onclick="copySummaryText('${safeTitle}', ${doc.id})" title="Copy AI summary">
                            <i class="bi bi-clipboard"></i>
                        </button>
                        <button class="btn btn-card-action danger" onclick="deleteDocument(${doc.id}, '${safeTitle}')" title="Delete document">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function resetFilters() {
    document.getElementById("searchBox").value = "";
    activeCategoryFilter = null;
    activeTypeFilter = 'All';
    filterType('All');
    loadDashboardData();
}

// ==========================
// Open Document Action
// ==========================
function handleOpenDoc(id) {
    const doc = allDocuments.find(d => d.id === id);
    if (!doc) return;
    trackOpen(id);

    if (doc.sourceUrl && doc.sourceUrl.startsWith("http")) {
        window.open(doc.sourceUrl, "_blank", "noopener,noreferrer");
    } else {
        showSummary(id);
    }
}

function copySummaryText(title, id) {
    const doc = allDocuments.find(d => d.id === id);
    if (doc && doc.summary) {
        navigator.clipboard.writeText(doc.summary);
        showToast("AI Summary copied to clipboard!");
    }
}

// ==========================
// Modal Details & Tabs
// ==========================
let currentModalDoc = null;

function showSummary(id) {
    const doc = allDocuments.find(d => d.id === id);
    if (!doc) return;
    currentModalDoc = doc;

    trackOpen(id);

    const title = doc.aiTitle || doc.originalTitle || "Untitled";
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalOriginalTitle").innerText = doc.originalTitle || doc.sourceUrl || "-";
    document.getElementById("modalSummary").innerText = doc.summary || "No summary available";

    const isPdf = doc.sourceType === "PDF";
    const srcBadge = document.getElementById("modalSourceBadge");
    srcBadge.innerText = isPdf ? "📄 PDF" : "🌐 Website";
    srcBadge.className = isPdf ? "badge bg-danger" : "badge bg-info";

    document.getElementById("modalCategoryBadge").innerText = doc.category || "General";

    const contentBox = document.getElementById("modalContent");
    contentBox.innerText = doc.content || "No raw text content available.";
    document.getElementById("modalCharCount").innerText = `Character count: ${(doc.content || '').length}`;

    const tagDiv = document.getElementById("modalTags");
    tagDiv.innerHTML = "";
    if (doc.tags) {
        doc.tags.split(",").forEach(tag => {
            const clean = tag.trim();
            if (clean) {
                tagDiv.innerHTML += `<span class="tag-pill-modern py-1 px-2" style="font-size: 0.8rem">#${escapeHtml(clean)}</span>`;
            }
        });
    }

    const websiteBtn = document.getElementById("modalWebsite");
    if (doc.sourceUrl && doc.sourceUrl.startsWith("http")) {
        websiteBtn.href = doc.sourceUrl;
        websiteBtn.style.display = "inline-flex";
    } else {
        websiteBtn.style.display = "none";
    }

    document.getElementById("modalDeleteBtn").onclick = () => {
        deleteDocument(doc.id, title);
        const modalEl = document.getElementById("summaryModal");
        bootstrap.Modal.getInstance(modalEl)?.hide();
    };

    switchModalTab('summary');
    const modalEl = document.getElementById("summaryModal");
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function switchModalTab(tab) {
    document.getElementById("tabSummaryBtn").classList.toggle("active", tab === 'summary');
    document.getElementById("tabContentBtn").classList.toggle("active", tab === 'content');
    document.getElementById("tabMetaBtn").classList.toggle("active", tab === 'meta');

    document.getElementById("modalTabSummary").style.display = tab === 'summary' ? 'block' : 'none';
    document.getElementById("modalTabContent").style.display = tab === 'content' ? 'block' : 'none';
    document.getElementById("modalTabMeta").style.display = tab === 'meta' ? 'block' : 'none';
}

function copyModalContent() {
    if (currentModalDoc && currentModalDoc.content) {
        navigator.clipboard.writeText(currentModalDoc.content);
        showToast("Full document text copied to clipboard!");
    }
}

async function trackOpen(id) {
    try {
        const res = await fetch(`/api/documents/open/${id}`);
        if (res.ok) {
            const updated = await res.json();
            const localDoc = allDocuments.find(d => d.id === id);
            if (localDoc) {
                localDoc.visitCount = updated.visitCount;
                const span = document.getElementById(`visit-${id}`);
                if (span) span.innerText = updated.visitCount;
            }
        }
    } catch (e) {
        console.warn("Could not track document visit:", e);
    }
}

// ==========================
// Delete Document
// ==========================
async function deleteDocument(id, title) {
    if (!confirm(`Delete "${title}" from Knowledge OS?`)) return;

    try {
        const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
        if (res.ok) {
            showToast("Document deleted successfully!");
            allDocuments = allDocuments.filter(d => d.id !== id);
            loadDashboardData();
        } else {
            showToast("Failed to delete document", false);
        }
    } catch (e) {
        console.error("Error deleting document:", e);
        showToast("Error deleting document", false);
    }
}

// ==========================
// Drag & Drop PDF Studio
// ==========================
function initDropzone() {
    const dropzone = document.getElementById("pdfDropzone");
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
                const input = document.getElementById("pdfFileInput");
                input.files = files;
                handleFileSelected(input);
            } else {
                showToast("Please select a valid PDF file", false);
            }
        }
    });
}

function handleFileSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        document.getElementById("dropzoneLabel").innerText = file.name;
        document.getElementById("dropzoneSub").innerText = `${(file.size / (1024 * 1024)).toFixed(2)} MB - Ready for AI extraction`;
    }
}

async function handlePdfUpload(event) {
    event.preventDefault();

    const fileInput = document.getElementById("pdfFileInput");
    const statusDiv = document.getElementById("uploadStatus");
    const uploadBtn = document.getElementById("uploadBtn");

    if (!fileInput.files || fileInput.files.length === 0) {
        showToast("Please select a PDF file first", false);
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    statusDiv.className = "alert alert-info small mt-3";
    statusDiv.classList.remove("d-none");
    statusDiv.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Extracting text and analyzing with Llama 3.2...`;
    uploadBtn.disabled = true;

    try {
        const response = await fetch("/api/pdf/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || `Server responded with status ${response.status}`);
        }

        const savedDoc = await response.json();
        statusDiv.className = "alert alert-success small mt-3";
        statusDiv.innerHTML = `<strong>Success!</strong> "${escapeHtml(savedDoc.aiTitle || savedDoc.originalTitle)}" was analyzed and saved!`;

        showToast("PDF analyzed and indexed successfully!");
        setTimeout(() => {
            const modalEl = document.getElementById("uploadPdfModal");
            bootstrap.Modal.getInstance(modalEl)?.hide();
            fileInput.value = "";
            document.getElementById("dropzoneLabel").innerText = "Click to select or drag PDF here";
            document.getElementById("dropzoneSub").innerText = "Supports standard PDF files up to 25MB";
            statusDiv.classList.add("d-none");
            uploadBtn.disabled = false;
            loadDashboardData();
        }, 1200);
    } catch (error) {
        console.error("PDF upload failed:", error);
        statusDiv.className = "alert alert-danger small mt-3";
        statusDiv.innerHTML = `<strong>Upload Failed:</strong> ${escapeHtml(error.message)}`;
        uploadBtn.disabled = false;
    }
}

// ==========================
// AI Copilot Chat (RAG Engine)
// ==========================
function sendQuickPrompt(prompt) {
    const input = document.getElementById("chatInput");
    if (input) {
        input.value = prompt;
        document.getElementById("chatForm")?.dispatchEvent(new Event("submit"));
    }
}

async function handleChatSubmit(event) {
    event.preventDefault();

    const input = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSendBtn");
    const messagesDiv = document.getElementById("chatMessages");
    const question = input.value.trim();

    if (!question) return;

    // Append user message
    messagesDiv.innerHTML += `
        <div class="chat-bubble-user">
            ${escapeHtml(question)}
        </div>
    `;

    input.value = "";
    sendBtn.disabled = true;

    // Append typing indicator
    const typingId = "typing-" + Date.now();
    messagesDiv.innerHTML += `
        <div id="${typingId}" class="chat-bubble-ai d-flex align-items-center gap-2">
            <span class="spinner-grow spinner-grow-sm text-primary"></span>
            <span class="small text-secondary">Analyzing knowledge vectors with Llama 3.2...</span>
        </div>
    `;

    const chatContainer = document.getElementById("chatContainer");
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: question })
        });

        const data = await response.json();
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        let sourcesHtml = "";
        if (data.sources && data.sources.length > 0) {
            sourcesHtml = `
                <div class="mt-2 pt-2 border-top border-subtle small">
                    <span class="text-muted fw-semibold me-1">Sources cited:</span>
                    ${data.sources.map(s => `<button class="badge bg-secondary-subtle text-primary border-0 me-1 mb-1 p-1 px-2" style="cursor: pointer" onclick="openSourceDoc('${escapeHtml(s)}')">📄 ${escapeHtml(s)}</button>`).join("")}
                </div>
            `;
        }

        messagesDiv.innerHTML += `
            <div class="chat-bubble-ai">
                <div style="white-space: pre-wrap;">${escapeHtml(data.answer || "No response synthesized.")}</div>
                ${sourcesHtml}
            </div>
        `;
    } catch (err) {
        console.error("Chat error:", err);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        messagesDiv.innerHTML += `
            <div class="chat-bubble-ai text-danger">
                Could not connect to AI service: ${escapeHtml(err.message)}
            </div>
        `;
    } finally {
        sendBtn.disabled = false;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function openSourceDoc(title) {
    const match = allDocuments.find(d => (d.aiTitle || d.originalTitle || "").toLowerCase().includes(title.toLowerCase()));
    if (match) {
        showSummary(match.id);
    }
}

// ==========================
// Utility: Escape HTML
// ==========================
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}