const { useState, useEffect, useMemo, useRef } = React;

// --- Helper Functions ---
function getDomain(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// --- Main App Component ---
function KnowledgeOSApp() {
    const [theme, setTheme] = useState(() => localStorage.getItem('kos_theme') || 'dark');
    const [documents, setDocuments] = useState([]);
    const [stats, setStats] = useState({ totalDocuments: 0, totalCategories: 0, websiteCount: 0, pdfCount: 0 });
    const [categoryStats, setCategoryStats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedType, setSelectedType] = useState('All');
    const [selectedSort, setSelectedSort] = useState('recent');
    const [loading, setLoading] = useState(true);

    // Modals state
    const [activeDocModal, setActiveDocModal] = useState(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    // Toast state
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

    const searchInputRef = useRef(null);

    // Apply Theme to DOM
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-bs-theme', theme);
        if (document.body) document.body.setAttribute('data-bs-theme', theme);
        localStorage.setItem('kos_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const showToast = (message, type = 'info') => {
        setToast({ visible: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3200);
    };

    // Hotkey handler (Cmd/Ctrl + K to focus search, Esc to close modals)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape') {
                setActiveDocModal(null);
                setIsUploadOpen(false);
                setIsCopilotOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Fetch initial data
    const refreshData = async () => {
        setLoading(true);
        try {
            const [dashRes, docsRes] = await Promise.all([
                fetch('/api/dashboard'),
                fetch('/api/documents')
            ]);
            const dashData = await dashRes.json();
            const docsData = await docsRes.json();

            const rawDocs = Array.isArray(docsData) ? docsData : (dashData.recentDocuments || []);
            const docs = rawDocs.map(d => ({
                ...d,
                title: d.aiTitle || d.originalTitle || d.title || 'Untitled Document',
                url: d.sourceUrl || d.url || '',
                tags: Array.isArray(d.tags) ? d.tags : (typeof d.tags === 'string' ? d.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
            }));
            setDocuments(docs);
            setCategoryStats(dashData.categoryStats || []);

            // Compute statistics
            let webCount = 0;
            let pdfCount = 0;
            const catSet = new Set();

            docs.forEach(d => {
                if (d.sourceType === 'Website') webCount++;
                else if (d.sourceType === 'PDF') pdfCount++;
                if (d.category) catSet.add(d.category.trim());
            });

            setStats({
                totalDocuments: docs.length,
                totalCategories: catSet.size,
                websiteCount: webCount,
                pdfCount: pdfCount
            });
        } catch (err) {
            console.error('Failed to load data:', err);
            showToast('Failed to connect to Knowledge OS backend.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    // Filter and sort documents
    const filteredDocuments = useMemo(() => {
        let result = [...documents];

        // Type filter
        if (selectedType === 'Website') {
            result = result.filter(d => d.sourceType === 'Website');
        } else if (selectedType === 'PDF') {
            result = result.filter(d => d.sourceType === 'PDF');
        } else if (selectedType === 'MostRead') {
            result = result.filter(d => (d.visitCount || 0) > 0);
            result.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
        }

        // Category filter
        if (selectedCategory) {
            result = result.filter(d => (d.category || 'Uncategorized').toLowerCase() === selectedCategory.toLowerCase());
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(d => {
                const title = (d.title || '').toLowerCase();
                const summary = (d.summary || '').toLowerCase();
                const category = (d.category || '').toLowerCase();
                const url = (d.url || '').toLowerCase();
                const tags = Array.isArray(d.tags) ? d.tags.join(' ').toLowerCase() : (d.tags || '').toLowerCase();
                return title.includes(q) || summary.includes(q) || category.includes(q) || url.includes(q) || tags.includes(q);
            });
        }

        // Default sort if not MostRead
        if (selectedType !== 'MostRead') {
            if (selectedSort === 'recent') {
                result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            } else if (selectedSort === 'visits') {
                result.sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0));
            } else if (selectedSort === 'title') {
                result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            }
        }

        return result;
    }, [documents, selectedType, selectedCategory, searchQuery, selectedSort]);

    // Open Document Action
    const handleOpenDocument = async (doc) => {
        try {
            fetch(`/api/documents/open/${doc.id}`).catch(() => {});
            // Optimistically increment visit count locally
            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, visitCount: (d.visitCount || 0) + 1 } : d));
        } catch (e) {
            console.error(e);
        }

        if (doc.url && doc.url.startsWith('http')) {
            window.open(doc.url, '_blank', 'noopener,noreferrer');
        } else {
            setActiveDocModal(doc);
        }
    };

    // Delete Document Action
    const handleDeleteDocument = async (id, title, e) => {
        e?.stopPropagation();
        if (!confirm(`Delete "${title || 'this item'}" from Knowledge OS?`)) return;

        try {
            const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Document deleted successfully', 'success');
                setDocuments(prev => prev.filter(d => d.id !== id));
                if (activeDocModal?.id === id) setActiveDocModal(null);
            } else {
                showToast('Failed to delete document', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error deleting document', 'error');
        }
    };

    return (
        <div className="kos-app">
            {/* Ambient Background Orbs */}
            <div className="ambient-orb orb-1"></div>
            <div className="ambient-orb orb-2"></div>
            <div className="ambient-orb orb-3"></div>

            {/* Navbar */}
            <Navbar
                theme={theme}
                toggleTheme={toggleTheme}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchInputRef={searchInputRef}
                onOpenUpload={() => setIsUploadOpen(true)}
                onOpenCopilot={() => setIsCopilotOpen(true)}
            />

            {/* Main Content Area */}
            <main className="container-fluid px-lg-4 mt-4 pb-5">
                {/* 4 Glass Stat Cards */}
                <StatsOverview stats={stats} />

                {/* Explorer Section: Sidebar + Category Rail + Grid */}
                <div className="row g-4 mt-1">
                    {/* Left Sidebar Filter Rail */}
                    <div className="col-12 col-lg-3 col-xl-2">
                        <FilterSidebar
                            selectedType={selectedType}
                            setSelectedType={setSelectedType}
                            categoryStats={categoryStats}
                            selectedCategory={selectedCategory}
                            setSelectedCategory={setSelectedCategory}
                            totalCount={documents.length}
                        />
                    </div>

                    {/* Main Content: Horizontal Category Chips + Sort + Grid */}
                    <div className="col-12 col-lg-9 col-xl-10">
                        {/* Interactive Toolbar */}
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                            {/* Category Filter Pills */}
                            <div className="category-pills-rail flex-grow-1">
                                <button
                                    className={`pill-filter ${selectedCategory === null ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(null)}
                                >
                                    <i className="bi bi-grid-fill me-1"></i> All Topics
                                </button>
                                {categoryStats.map(c => (
                                    <button
                                        key={c.category}
                                        className={`pill-filter ${selectedCategory === c.category ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(prev => prev === c.category ? null : c.category)}
                                    >
                                        <span>📂 {c.category}</span>
                                        <span className="badge bg-white text-dark rounded-pill ms-1 px-1 py-0" style={{ fontSize: '0.65rem' }}>{c.count}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Sort Dropdown */}
                            <div className="d-flex align-items-center gap-2">
                                <span className="text-secondary small fw-medium d-none d-sm-inline">Sort:</span>
                                <select
                                    className="form-select form-select-sm bg-glass text-primary border-subtle"
                                    style={{ borderRadius: 'var(--radius-full)', width: 'auto', paddingRight: '2rem' }}
                                    value={selectedSort}
                                    onChange={e => setSelectedSort(e.target.value)}
                                >
                                    <option value="recent">Most Recent</option>
                                    <option value="visits">Most Read</option>
                                    <option value="title">Alphabetical</option>
                                </select>
                            </div>
                        </div>

                        {/* Documents Grid */}
                        <DocumentGrid
                            loading={loading}
                            documents={filteredDocuments}
                            onOpen={handleOpenDocument}
                            onViewDetails={(doc) => setActiveDocModal(doc)}
                            onDelete={handleDeleteDocument}
                            onCopySummary={(text) => {
                                navigator.clipboard.writeText(text);
                                showToast('AI Summary copied to clipboard!', 'success');
                            }}
                            searchQuery={searchQuery}
                            onClearFilter={() => { setSearchQuery(''); setSelectedCategory(null); setSelectedType('All'); }}
                        />
                    </div>
                </div>
            </main>

            {/* Floating Copilot Dock Button */}
            <button
                className="floating-copilot-trigger"
                onClick={() => setIsCopilotOpen(true)}
                title="Ask Knowledge OS Copilot"
            >
                <i className="bi bi-stars"></i>
                <span className="d-none d-sm-inline">AI Copilot</span>
            </button>

            {/* Modals */}
            {activeDocModal && (
                <DocumentReaderModal
                    doc={activeDocModal}
                    onClose={() => setActiveDocModal(null)}
                    onDelete={(id, title) => handleDeleteDocument(id, title)}
                    showToast={showToast}
                />
            )}

            {isUploadOpen && (
                <UploadPdfModal
                    onClose={() => setIsUploadOpen(false)}
                    onSuccess={(newDoc) => {
                        showToast('PDF analyzed and saved successfully!', 'success');
                        refreshData();
                    }}
                    showToast={showToast}
                />
            )}

            {isCopilotOpen && (
                <AiCopilotModal
                    onClose={() => setIsCopilotOpen(false)}
                    onOpenDoc={(docTitle) => {
                        const match = documents.find(d => d.title?.toLowerCase().includes(docTitle.toLowerCase()));
                        if (match) setActiveDocModal(match);
                    }}
                />
            )}

            {/* Global Glass Toast Notification */}
            <div className={`knowledge-toast ${toast.visible ? 'show' : ''}`}>
                <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-check-circle-fill text-success'}`}></i>
                <span>{toast.message}</span>
            </div>
        </div>
    );
}

// --- Navbar Component ---
function Navbar({ theme, toggleTheme, searchQuery, setSearchQuery, searchInputRef, onOpenUpload, onOpenCopilot }) {
    return (
        <nav className="navbar navbar-expand-lg app-navbar">
            <div className="container-fluid px-lg-4">
                <a className="brand-gradient me-3" href="/dashboard">
                    <div className="brand-icon-box">🧠</div>
                    <span>Knowledge OS</span>
                </a>

                {/* Live AI Pulse Badge */}
                <div className="ai-status-pill d-none d-md-inline-flex me-4">
                    <span className="pulse-dot"></span>
                    <span>AI Brain: Llama 3.2</span>
                </div>

                {/* Spotlight Global Search */}
                <div className="search-wrapper mx-auto my-2 my-lg-0">
                    <i className="bi bi-search search-icon"></i>
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="form-control search-input"
                        placeholder="Search across documents, summaries, tags..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        autoComplete="off"
                    />
                    {searchQuery ? (
                        <button
                            className="btn btn-link text-muted position-absolute p-0"
                            style={{ right: '14px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent' }}
                            onClick={() => setSearchQuery('')}
                        >
                            <i className="bi bi-x-circle-fill"></i>
                        </button>
                    ) : (
                        <span className="kbd-shortcut">⌘K</span>
                    )}
                </div>

                {/* Actions & Theme */}
                <div className="d-flex align-items-center gap-2 ms-auto">
                    <button className="btn btn-card-action primary d-flex align-items-center gap-2" onClick={onOpenUpload}>
                        <i className="bi bi-cloud-arrow-up-fill"></i>
                        <span className="d-none d-sm-inline">Upload PDF</span>
                    </button>

                    <button className="btn btn-card-action d-flex align-items-center gap-2" onClick={onOpenCopilot}>
                        <i className="bi bi-stars text-primary"></i>
                        <span className="d-none d-sm-inline">Ask AI</span>
                    </button>

                    {/* Theme Switcher */}
                    <button
                        className="btn-theme-toggle ms-1"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                    >
                        <i className={`bi ${theme === 'dark' ? 'bi-moon-stars-fill' : 'bi-sun-fill text-warning'}`}></i>
                    </button>
                </div>
            </div>
        </nav>
    );
}

// --- Stats Overview (4 Glass Cards) ---
function StatsOverview({ stats }) {
    return (
        <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
                <div className="stat-card-glass" style={{ '--card-accent': 'var(--gradient-primary)', '--card-glow': 'rgba(99, 102, 241, 0.2)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Total Knowledge</span>
                        <div className="stat-icon text-primary"><i className="bi bi-database-fill"></i></div>
                    </div>
                    <div className="stat-number">{stats.totalDocuments}</div>
                    <div className="text-secondary small mt-2">
                        <span className="badge bg-primary-subtle text-primary stat-badge">Indexed</span>
                    </div>
                </div>
            </div>

            <div className="col-6 col-lg-3">
                <div className="stat-card-glass" style={{ '--card-accent': 'var(--gradient-cyan)', '--card-glow': 'rgba(6, 182, 212, 0.2)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Web Pages</span>
                        <div className="stat-icon" style={{ color: 'var(--accent-cyan)' }}><i className="bi bi-globe2"></i></div>
                    </div>
                    <div className="stat-number">{stats.websiteCount}</div>
                    <div className="text-secondary small mt-2">
                        <span className="badge bg-info-subtle text-info stat-badge">Chrome Extension</span>
                    </div>
                </div>
            </div>

            <div className="col-6 col-lg-3">
                <div className="stat-card-glass" style={{ '--card-accent': 'var(--gradient-rose)', '--card-glow': 'rgba(244, 63, 94, 0.2)' }}>
                    <div className="stat-header">
                        <span className="stat-label">PDF Documents</span>
                        <div className="stat-icon" style={{ color: 'var(--accent-rose)' }}><i className="bi bi-file-earmark-pdf-fill"></i></div>
                    </div>
                    <div className="stat-number">{stats.pdfCount}</div>
                    <div className="text-secondary small mt-2">
                        <span className="badge bg-danger-subtle text-danger stat-badge">AI Ingested</span>
                    </div>
                </div>
            </div>

            <div className="col-6 col-lg-3">
                <div className="stat-card-glass" style={{ '--card-accent': 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', '--card-glow': 'rgba(168, 85, 247, 0.2)' }}>
                    <div className="stat-header">
                        <span className="stat-label">Active Topics</span>
                        <div className="stat-icon" style={{ color: 'var(--accent-purple)' }}><i className="bi bi-folder-symlink-fill"></i></div>
                    </div>
                    <div className="stat-number">{stats.totalCategories}</div>
                    <div className="text-secondary small mt-2">
                        <span className="badge bg-purple-subtle text-primary stat-badge">Auto Clustered</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Filter Sidebar Rail ---
function FilterSidebar({ selectedType, setSelectedType, categoryStats, selectedCategory, setSelectedCategory, totalCount }) {
    return (
        <div className="filter-glass-sidebar">
            <h6 className="text-muted text-uppercase fw-bold px-2 mb-2" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                Knowledge Views
            </h6>

            <div
                className={`filter-item ${selectedType === 'All' && !selectedCategory ? 'active' : ''}`}
                onClick={() => { setSelectedType('All'); setSelectedCategory(null); }}
            >
                <i className="bi bi-collection-fill"></i>
                <span className="flex-grow-1">All Documents</span>
                <span className="badge rounded-pill bg-white text-dark opacity-75">{totalCount}</span>
            </div>

            <div
                className={`filter-item ${selectedType === 'Website' ? 'active' : ''}`}
                onClick={() => setSelectedType('Website')}
            >
                <i className="bi bi-globe2 text-cyan"></i>
                <span className="flex-grow-1">Web Articles</span>
            </div>

            <div
                className={`filter-item ${selectedType === 'PDF' ? 'active' : ''}`}
                onClick={() => setSelectedType('PDF')}
            >
                <i className="bi bi-file-earmark-pdf-fill text-rose"></i>
                <span className="flex-grow-1">PDF Papers</span>
            </div>

            <div
                className={`filter-item ${selectedType === 'MostRead' ? 'active' : ''}`}
                onClick={() => setSelectedType('MostRead')}
            >
                <i className="bi bi-fire text-warning"></i>
                <span className="flex-grow-1">Frequently Read</span>
            </div>

            <hr className="my-3 border-subtle" />

            <h6 className="text-muted text-uppercase fw-bold px-2 mb-2" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                Categories ({categoryStats.length})
            </h6>

            <div className="category-scroll-list" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {categoryStats.length === 0 ? (
                    <div className="p-2 text-muted small">No topics indexed yet.</div>
                ) : (
                    categoryStats.map(c => (
                        <div
                            key={c.category}
                            className={`category-chip-btn ${selectedCategory === c.category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(prev => prev === c.category ? null : c.category)}
                        >
                            <span className="text-truncate me-2 small">📂 {c.category}</span>
                            <span className="badge bg-secondary-subtle text-secondary rounded-pill">{c.count}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// --- Document Grid & Empty States ---
function DocumentGrid({ loading, documents, onOpen, onViewDetails, onDelete, onCopySummary, searchQuery, onClearFilter }) {
    if (loading) {
        return (
            <div className="row g-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="col-12 col-md-6 col-xl-4">
                        <div className="knowledge-card-glass p-4 text-center">
                            <div className="spinner-border text-primary my-4" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <div className="text-muted small">Loading Knowledge Base...</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className="text-center py-5">
                <div className="display-4 text-muted mb-3">🔍</div>
                <h5 className="fw-bold text-highlight">No Knowledge Records Found</h5>
                <p className="text-secondary small max-w-md mx-auto">
                    {searchQuery ? `No documents matched "${searchQuery}". Try a different keyword or clear filters.` : 'Start browsing with the Chrome Extension or upload a PDF to build your AI memory.'}
                </p>
                <button className="btn btn-card-action primary mt-2" onClick={onClearFilter}>
                    <i className="bi bi-arrow-repeat"></i> Reset All Filters
                </button>
            </div>
        );
    }

    return (
        <div className="row g-3">
            {documents.map(doc => (
                <div key={doc.id} className="col-12 col-md-6 col-xl-4">
                    <DocumentCard
                        doc={doc}
                        onOpen={onOpen}
                        onViewDetails={onViewDetails}
                        onDelete={onDelete}
                        onCopySummary={onCopySummary}
                    />
                </div>
            ))}
        </div>
    );
}

// --- Individual Document Card (2026 Glassmorphism) ---
function DocumentCard({ doc, onOpen, onViewDetails, onDelete, onCopySummary }) {
    const isPdf = doc.sourceType === 'PDF';
    const domain = doc.url ? getDomain(doc.url) : (isPdf ? 'Local File' : 'Document');
    const tags = Array.isArray(doc.tags) ? doc.tags : (doc.tags ? doc.tags.split(',') : []);

    return (
        <div className="knowledge-card-glass">
            {/* Top Meta: Source Badge + Category Badge */}
            <div className="card-top-meta">
                <div className={`source-badge ${isPdf ? 'pdf' : 'website'}`}>
                    <i className={`bi ${isPdf ? 'bi-file-earmark-pdf-fill' : 'bi-globe2'}`}></i>
                    <span>{doc.sourceType || 'Article'}</span>
                </div>
                {doc.category && (
                    <div className="category-badge-glass text-truncate" style={{ maxWidth: '140px' }} title={doc.category}>
                        {doc.category}
                    </div>
                )}
            </div>

            {/* Document Title */}
            <h6 className="knowledge-title" title={doc.title || 'Untitled Document'}>
                {doc.title || 'Untitled Document'}
            </h6>

            {/* AI Summary */}
            <p className="knowledge-summary">
                {doc.summary || 'Summary processing or not available.'}
            </p>

            {/* Tag Pills */}
            <div className="mb-3 d-flex flex-wrap" style={{ minHeight: '26px' }}>
                {tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="tag-pill-modern">
                        #{tag.trim()}
                    </span>
                ))}
                {tags.length > 3 && (
                    <span className="tag-pill-modern text-muted">+{tags.length - 3}</span>
                )}
            </div>

            {/* Footer Meta */}
            <div className="card-footer-meta">
                <span className="text-truncate me-2" style={{ maxWidth: '140px' }}>
                    <i className="bi bi-link-45deg"></i> {domain}
                </span>
                <span>
                    <i className="bi bi-eye me-1"></i> {doc.visitCount || 0} visits
                </span>
            </div>

            {/* Card Action Buttons */}
            <div className="card-actions-toolbar">
                <button
                    className="btn btn-card-action primary"
                    onClick={() => onOpen(doc)}
                    title="Open original website or reader"
                >
                    <i className="bi bi-box-arrow-up-right"></i> Open
                </button>
                <button
                    className="btn btn-card-action"
                    onClick={() => onViewDetails(doc)}
                    title="Inspect AI insights & full content"
                >
                    <i className="bi bi-file-text"></i> Details
                </button>
                <button
                    className="btn btn-card-action"
                    onClick={() => onCopySummary(doc.summary || '')}
                    title="Copy AI summary"
                >
                    <i className="bi bi-clipboard"></i>
                </button>
                <button
                    className="btn btn-card-action danger"
                    onClick={(e) => onDelete(doc.id, doc.title, e)}
                    title="Delete document"
                >
                    <i className="bi bi-trash3-fill"></i>
                </button>
            </div>
        </div>
    );
}

// --- Document Reader / Details Modal (Tabs: AI Executive Brief, Full Content, Raw Metadata) ---
function DocumentReaderModal({ doc, onClose, onDelete, showToast }) {
    const [activeTab, setActiveTab] = useState('summary');
    const isPdf = doc.sourceType === 'PDF';
    const tags = Array.isArray(doc.tags) ? doc.tags : (doc.tags ? doc.tags.split(',') : []);

    return (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)', zIndex: 1060 }}>
            <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
                <div className="modal-content modal-content-glass">
                    {/* Modal Header */}
                    <div className="modal-header modal-header-glass d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2 text-truncate me-2">
                            <span className={`badge ${isPdf ? 'bg-danger' : 'bg-info'}`}>{doc.sourceType}</span>
                            <h5 className="modal-title fw-bold text-highlight text-truncate mb-0" style={{ maxWidth: '460px' }}>
                                {doc.title || 'Document Insights'}
                            </h5>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    {/* Nav Tabs */}
                    <div className="px-4 pt-3 pb-0">
                        <div className="custom-nav-tabs">
                            <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>
                                <i className="bi bi-stars text-primary me-1"></i> Executive Brief
                            </button>
                            <button className={activeTab === 'content' ? 'active' : ''} onClick={() => setActiveTab('content')}>
                                <i className="bi bi-file-earmark-text me-1"></i> Full Extracted Text
                            </button>
                            <button className={activeTab === 'meta' ? 'active' : ''} onClick={() => setActiveTab('meta')}>
                                <i className="bi bi-info-circle me-1"></i> Metadata & Vectors
                            </button>
                        </div>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body modal-body-glass pt-2">
                        {activeTab === 'summary' && (
                            <div>
                                <div className="p-3 mb-3 rounded" style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                    <h6 className="fw-bold text-primary mb-2"><i className="bi bi-lightbulb-fill"></i> AI Generated Summary:</h6>
                                    <p className="mb-0" style={{ lineHeight: 1.7, fontSize: '0.95rem' }}>{doc.summary || 'No summary available.'}</p>
                                </div>

                                <div className="mb-3">
                                    <h6 className="fw-semibold text-secondary small text-uppercase">Extracted Concepts & Tags</h6>
                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                        {tags.length > 0 ? tags.map((t, idx) => (
                                            <span key={idx} className="tag-pill-modern py-1 px-2" style={{ fontSize: '0.8rem' }}>#{t.trim()}</span>
                                        )) : <span className="text-muted small">No tags extracted.</span>}
                                    </div>
                                </div>

                                {doc.url && (
                                    <div className="mt-3">
                                        <h6 className="fw-semibold text-secondary small text-uppercase">Source URL</h6>
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-cyan small text-break">
                                            {doc.url}
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'content' && (
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small">Character count: {(doc.content || '').length}</span>
                                    <button
                                        className="btn btn-sm btn-card-action"
                                        onClick={() => {
                                            navigator.clipboard.writeText(doc.content || '');
                                            showToast('Full content copied!', 'success');
                                        }}
                                    >
                                        <i className="bi bi-clipboard"></i> Copy Text
                                    </button>
                                </div>
                                <div
                                    className="p-3 rounded border border-subtle bg-main text-secondary small"
                                    style={{ maxHeight: '350px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                                >
                                    {doc.content || 'No text content available for this document.'}
                                </div>
                            </div>
                        )}

                        {activeTab === 'meta' && (
                            <div className="table-responsive">
                                <table className="table table-dark table-sm border-subtle mb-0" style={{ background: 'transparent' }}>
                                    <tbody>
                                        <tr>
                                            <td className="text-muted" style={{ width: '140px' }}>Document ID</td>
                                            <td className="font-monospace text-primary small">{doc.id}</td>
                                        </tr>
                                        <tr>
                                            <td className="text-muted">Source Type</td>
                                            <td>{doc.sourceType}</td>
                                        </tr>
                                        <tr>
                                            <td className="text-muted">Category</td>
                                            <td><span className="badge bg-primary-subtle text-primary">{doc.category || 'Uncategorized'}</span></td>
                                        </tr>
                                        <tr>
                                            <td className="text-muted">Total Opens</td>
                                            <td>{doc.visitCount || 0} times</td>
                                        </tr>
                                        <tr>
                                            <td className="text-muted">Indexed Date</td>
                                            <td>{formatDate(doc.createdAt)}</td>
                                        </tr>
                                        <tr>
                                            <td className="text-muted">Vector Search Ready</td>
                                            <td><span className="badge bg-success-subtle text-success">Indexed in ChromaDB</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="modal-footer modal-footer-glass d-flex justify-content-between">
                        <button
                            type="button"
                            className="btn btn-card-action danger"
                            onClick={(e) => onDelete(doc.id, doc.title, e)}
                        >
                            <i className="bi bi-trash3-fill"></i> Delete Document
                        </button>
                        <div className="d-flex gap-2">
                            {doc.url && (
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-card-action primary">
                                    <i className="bi bi-box-arrow-up-right"></i> Open Source
                                </a>
                            )}
                            <button type="button" className="btn btn-card-action" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Drag & Drop PDF Ingestion Studio Modal ---
function UploadPdfModal({ onClose, onSuccess, showToast }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropped = e.dataTransfer.files[0];
            if (dropped.type === 'application/pdf' || dropped.name.endsWith('.pdf')) {
                setFile(dropped);
            } else {
                showToast('Please select a valid PDF file.', 'error');
            }
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            showToast('Please select a PDF file first.', 'error');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/pdf/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                onSuccess(data);
                onClose();
            } else {
                const errText = await res.text();
                showToast(`Upload failed: ${errText || 'Server error'}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error while uploading PDF.', 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)', zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content modal-content-glass">
                    <div className="modal-header modal-header-glass">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-file-earmark-arrow-up-fill text-rose fs-5"></i>
                            <h5 className="modal-title fw-bold text-highlight mb-0">PDF Knowledge Studio</h5>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={uploading}></button>
                    </div>

                    <form onSubmit={handleUpload}>
                        <div className="modal-body modal-body-glass">
                            <p className="text-secondary small">
                                Upload research papers, documentation, or textbooks. The AI engine parses sections, generates an executive summary, tags topics, and indexes vectors into ChromaDB.
                            </p>

                            {/* Dropzone */}
                            <div
                                className={`pdf-dropzone mb-3 ${dragOver ? 'dragover' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="bi bi-file-earmark-pdf display-5 text-rose mb-2 d-block"></i>
                                <h6 className="fw-bold mb-1">
                                    {file ? file.name : 'Click to select or drag PDF here'}
                                </h6>
                                <span className="text-muted small">
                                    {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB - Ready for AI extraction` : 'Supports standard PDF files up to 25MB'}
                                </span>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                className="d-none"
                                accept="application/pdf"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) setFile(e.target.files[0]);
                                }}
                            />

                            {uploading && (
                                <div className="text-center py-2">
                                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                                    <span className="small text-primary fw-semibold">Extracting text & running Llama 3.2 summarization...</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer modal-footer-glass">
                            <button type="button" className="btn btn-card-action" onClick={onClose} disabled={uploading}>Cancel</button>
                            <button type="submit" className="btn btn-card-action primary" disabled={uploading || !file}>
                                {uploading ? 'Processing AI...' : 'Upload & Analyze with AI'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

// --- AI Copilot Modal (RAG Natural Language Q&A Engine) ---
function AiCopilotModal({ onClose, onOpenDoc }) {
    const [messages, setMessages] = useState([
        {
            role: 'ai',
            text: 'Hello! I am your Knowledge OS Copilot. Ask me anything about your saved web pages and documents, or select a prompt below.'
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSend = async (messageText) => {
        const text = (messageText || input).trim();
        if (!text || loading) return;

        setInput('');
        setMessages(prev => [...prev, { role: 'user', text }]);
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'ai',
                        text: data.answer || 'I could not synthesize an answer from the indexed documents.',
                        sources: data.sources || []
                    }
                ]);
            } else {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'ai',
                        text: 'Sorry, the AI service encountered an error while retrieving knowledge.',
                        error: true
                    }
                ]);
            }
        } catch (err) {
            console.error(err);
            setMessages(prev => [
                ...prev,
                {
                    role: 'ai',
                    text: 'Network connection failed. Please ensure Knowledge OS backend is running.',
                    error: true
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)', zIndex: 1060 }}>
            <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
                <div className="modal-content modal-content-glass">
                    {/* Header */}
                    <div className="modal-header modal-header-glass d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                            <div className="brand-icon-box" style={{ width: '32px', height: '32px', fontSize: '15px' }}>✨</div>
                            <h5 className="modal-title fw-bold text-highlight mb-0">Knowledge OS Copilot</h5>
                            <span className="badge bg-primary-subtle text-primary border border-subtle ms-2">RAG Engine</span>
                        </div>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    {/* Chat Body */}
                    <div className="modal-body modal-body-glass" style={{ minHeight: '380px', maxHeight: '480px' }}>
                        {/* Quick Prompts */}
                        {messages.length <= 2 && (
                            <div className="mb-4">
                                <p className="text-secondary small mb-2"><i className="bi bi-lightbulb-fill text-warning"></i> Quick inquiries:</p>
                                <div className="d-flex flex-wrap gap-2">
                                    <button className="chat-prompt-suggestion" onClick={() => handleSend('Summarize key topics in my knowledge base')}>
                                        📊 Summarize key topics
                                    </button>
                                    <button className="chat-prompt-suggestion" onClick={() => handleSend('What programming or tech concepts are saved?')}>
                                        💻 Programming concepts
                                    </button>
                                    <button className="chat-prompt-suggestion" onClick={() => handleSend('What are the main takeaways from recent documents?')}>
                                        💡 Recent takeaways
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Chat Messages */}
                        <div className="d-flex flex-column gap-3">
                            {messages.map((m, idx) => (
                                <div key={idx} className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                    {m.sources && m.sources.length > 0 && (
                                        <div className="mt-2 pt-2 border-top border-subtle small">
                                            <span className="text-muted fw-semibold me-1">Sources cited:</span>
                                            {m.sources.map((src, sIdx) => (
                                                <button
                                                    key={sIdx}
                                                    className="badge bg-secondary-subtle text-primary border-0 me-1 mb-1 p-1 px-2"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => onOpenDoc(src)}
                                                >
                                                    📄 {src}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="chat-bubble-ai d-flex align-items-center gap-2">
                                    <div className="spinner-grow spinner-grow-sm text-primary" role="status"></div>
                                    <span className="small text-secondary">Analyzing knowledge vectors with Llama 3.2...</span>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Footer Form */}
                    <div className="modal-footer modal-footer-glass bg-transparent">
                        <form
                            className="w-100 d-flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                        >
                            <input
                                type="text"
                                className="form-control search-input flex-grow-1"
                                placeholder="Ask a question about your knowledge..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={loading}
                                autoFocus
                            />
                            <button type="submit" className="btn btn-card-action primary px-4" disabled={loading || !input.trim()}>
                                <i className="bi bi-send-fill"></i>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Render React App
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<KnowledgeOSApp />);
}
