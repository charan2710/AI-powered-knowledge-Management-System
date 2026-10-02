# 🧠 Knowledge OS — AI-Powered Personal Knowledge Management System

Knowledge OS is a full-stack, AI-powered knowledge management system built with **Spring Boot 3**, **Ollama LLM & Embeddings**, **ChromaDB**, and **MySQL**. It enables automatic document and webpage ingestion, automated AI tagging and summarization, hybrid persistence, and semantic Retrieval-Augmented Generation (RAG) chat.

---

## 📑 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Step-by-Step Setup Guide](#-step-by-step-setup-guide)
  - [Step 1: Clone the Repository](#step-1-clone-the-repository)
  - [Step 2: MySQL Database Setup](#step-2-mysql-database-setup)
  - [Step 3: Ollama Setup (LLM & Embeddings)](#step-3-ollama-setup-llm--embeddings)
  - [Step 4: ChromaDB Setup (Vector Database)](#step-4-chromadb-setup-vector-database)
  - [Step 5: Configure Application Properties](#step-5-configure-application-properties)
  - [Step 6: Build & Run Spring Boot Backend](#step-6-build--run-spring-boot-backend)
  - [Step 7: Load Chrome Extension](#step-7-load-chrome-extension)
- [Verifying the Semantic RAG Pipeline](#-verifying-the-semantic-rag-pipeline)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Project Directory Structure](#-project-directory-structure)

---

## 🏗 Architecture Overview

```
[Webpage / Chrome Ext]       [PDF Upload]       [Manual Document]
          │                       │                     │
          └───────────────────────┼─────────────────────┘
                                  ▼
                     [15K-Character Extraction Cap]
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[8K-Character AI Analysis]                        [MySQL Database]
(Title, Summary, Category, Tags)                (System Source of Truth)
         │                                                 │
         └────────────────────────┬────────────────────────┘
                                  ▼
                      [Sliding-Window Text Chunking]
                      (1000 chars, 150-char overlap)
                                  │
                                  ▼
                      [Ollama Vector Embedding]
                    (Model: nomic-embed-text, 768-dim)
                                  │
                                  ▼
                      [ChromaDB Vector Storage]
                    (Collection: knowledge_documents)
                                  │
══════════════════════════════════╪════════════════════════════════════════
Semantic Query & RAG Retrieval:   │
══════════════════════════════════╪════════════════════════════════════════
                                  │
       [User Question]            │
              │                   │
              ▼                   │
    [Query Embedding]             │
    (nomic-embed-text)            │
              │                   │
              ▼                   │
     [Vector Similarity Search] ──┴────► [ChromaDB Top-5 Search]
                                                 │
                                                 ▼
                                        [Top-5 Semantic Chunks]
                                                 │
                                                 ▼
                                        [Grounded Context Prompt]
                                                 │
                                                 ▼
                                        [Ollama LLM (llama3.2)]
                                                 │
                                                 ▼
                                    [Synthesized Answer + Citations]
```

### Key Architectural Highlights
1. **Multi-Source Ingestion:** Seamlessly capture knowledge via Chrome Extension, PDF upload, or REST APIs.
2. **15K-Character Extraction Limit:** Enforces extraction guardrails preventing bloated inputs.
3. **8K-Character AI Analysis:** Uses Ollama (`llama3.2`) to generate clean titles, summaries, categories, and tags.
4. **Hybrid Storage:**
   - **MySQL:** Relational source of truth storing full content, categories, tags, and audit timestamps.
   - **ChromaDB:** Dedicated vector store indexing chunked embeddings for semantic search.
5. **Top-5 Semantic Retrieval:** Translates user questions into dense vectors and queries ChromaDB using Cosine/L2 similarity.
6. **Lifecycle Synchronization:** Document updates and deletions automatically sync vectors in ChromaDB to eliminate stale embeddings.

---

## 🛠 Tech Stack

- **Backend:** Java 21, Spring Boot 3.5.x, Spring AI, Spring Data JPA, Hibernate, Maven
- **LLM & Embeddings:** [Ollama](https://ollama.com/) (`llama3.2` for text synthesis & analysis, `nomic-embed-text` for 768-dim embeddings)
- **Vector Database:** [ChromaDB](https://www.trychroma.com/) (REST API v2)
- **Relational Database:** MySQL 8.x
- **PDF Extraction:** Apache PDFBox 3.x
- **Browser Extension:** Chrome Extension Manifest V3 (JavaScript)
- **Frontend Dashboard:** Thymeleaf, Bootstrap 5, Vanilla JS / React

---

## 📋 Prerequisites

Ensure the following tools are installed on your machine:

1. **Java Development Kit (JDK):** Version 21 or higher  
   * Verify: `java -version`
2. **Apache Maven:** Version 3.8+ (or use the included `./mvnw` wrapper)  
   * Verify: `mvn -version`
3. **MySQL Server:** Version 8.0 or higher  
   * Verify: `mysql --version`
4. **Python:** Version 3.10 to 3.12 (required for ChromaDB)  
   * Verify: `python --version`
5. **Ollama:** Latest version  
   * Download from: [https://ollama.com/download](https://ollama.com/download)  
   * Verify: `ollama --version`
6. **Google Chrome:** (or Chromium-based browser) for the extension

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/charan2710/AI-powered-knowledge-management-system.git
cd AI-powered-knowledge-management-system
```

---

### Step 2: MySQL Database Setup

1. Start your local MySQL service.
2. Open MySQL client or command prompt:
   ```bash
   mysql -u root -p
   ```
3. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS knowledge_os;
   ```
4. Verify the database exists:
   ```sql
   SHOW DATABASES;
   ```

---

### Step 3: Ollama Setup (LLM & Embeddings)

1. **Start Ollama service:**
   ```bash
   ollama serve
   ```
   *(Keep this terminal open or ensure Ollama runs in the background. Default port: `11434`)*

2. **Pull the Chat/Analysis LLM (`llama3.2`):**
   ```bash
   ollama pull llama3.2
   ```

3. **Pull the Embedding Model (`nomic-embed-text`):**
   ```bash
   ollama pull nomic-embed-text
   ```

4. **Verify installed models:**
   ```bash
   ollama list
   ```
   You should see both `llama3.2:latest` and `nomic-embed-text:latest`.

---

### Step 4: ChromaDB Setup (Vector Database)

1. **Install ChromaDB using pip:**
   ```bash
   pip install chromadb
   ```

2. **Run ChromaDB Server:**  
   Open a separate terminal in the project root directory and run:

   ```bash
   # Windows (PowerShell/CMD)
   chroma run --path ./chroma --host 127.0.0.1 --port 8000

   # macOS / Linux
   chroma run --path ./chroma --host 127.0.0.1 --port 8000
   ```

   > 💡 **Important on Windows:** Always explicitly pass `--host 127.0.0.1` so Chroma binds to IPv4 loopback, matching Java HTTP client resolution.

3. **Verify ChromaDB is running:**
   ```bash
   curl http://127.0.0.1:8000/api/v2/heartbeat
   ```
   Expected response:
   ```json
   {"nanosecond heartbeat": 1790881783309844300}
   ```

---

### Step 5: Configure Application Properties

Open `knowledge-os/src/main/resources/application.properties` and verify your local configurations:

```properties
spring.application.name=knowledge-os

# Database Configuration
spring.datasource.url=jdbc:mysql://localhost:3306/knowledge_os?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD

# Ollama LLM & Embeddings Configuration
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.options.model=llama3.2
spring.ai.ollama.embedding.options.model=nomic-embed-text
ollama.embedding.model=nomic-embed-text

# JPA / Hibernate
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.open-in-view=false

# ChromaDB Configuration
chroma.base-url=http://127.0.0.1:8000
chroma.collection.name=knowledge_documents

# RAG & Chunking Parameters
rag.top-k=5
rag.chunk-size=1000
rag.chunk-overlap=150
rag.max-extraction-length=15000

# Server
server.port=8080
spring.thymeleaf.cache=false
```

---

### Step 6: Build & Run Spring Boot Backend

Navigate to the `knowledge-os` directory:

```bash
cd knowledge-os
```

**Build the project:**
```bash
# Windows
.\mvnw.cmd clean compile

# macOS / Linux
./mvnw clean compile
```

**Run the application:**
```bash
# Windows
.\mvnw.cmd spring-boot:run

# macOS / Linux
./mvnw spring-boot:run
```

Once started, the backend runs on:  
👉 **`http://localhost:8080`**

Open **`http://localhost:8080`** in your browser to access the Knowledge OS Dashboard.

---

### Step 7: Load Chrome Extension

1. Open Google Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `knowledge-extension` directory inside this repository:  
   `AI-powered-knowledge-management-system/knowledge-extension`
5. The **Knowledge OS** extension icon will appear in your Chrome toolbar.
6. Visit any article or blog post and click the extension icon → **"Save Page"**. The content will be extracted, analyzed by Ollama, saved in MySQL, and indexed in ChromaDB automatically!

---

## 🧪 Verifying the Semantic RAG Pipeline

### 1. Ingest a Document
Add a sample document via the REST API:

```bash
curl -X POST http://localhost:8080/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Spring Dependency Management",
    "content": "Spring Boot dependency injection allows objects to be managed by the IoC container.",
    "category": "Engineering",
    "sourceType": "Manual"
  }'
```

### 2. Perform a Semantic RAG Query
Ask a question with different wording to test semantic similarity (not simple keyword matching):

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How does Spring manage object dependencies?"
  }'
```

**Response:**
```json
{
  "answer": "According to the retrieved context, Spring Boot dependency injection allows objects to be managed by the IoC (Inversion of Control) container. This means the IoC container handles creating and wiring object dependencies.",
  "sources": [
    "Spring Dependency Management"
  ],
  "success": true
}
```

### 3. Check Server Logs
Observe the backend terminal showing the complete RAG execution trail:
```text
INFO c.c.knowledge_os.rag.RAGService   : Generating query embedding for question...
INFO c.c.knowledge_os.rag.RAGService   : Searching ChromaDB for top-5 semantic chunks...
INFO c.c.k.rag.VectorStoreService      : ChromaDB returned 5 similar chunks
INFO c.c.knowledge_os.rag.RAGService   : Building RAG context from 5 retrieved chunks...
INFO c.c.knowledge_os.rag.RAGService   : Sending context to Ollama LLM...
INFO c.c.knowledge_os.rag.RAGService   : RAG response generated successfully
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Semantic RAG query against ChromaDB + Ollama LLM |
| `POST` | `/api/webpage/save` | Ingests webpage from Chrome Extension (15K guardrail + AI tag) |
| `POST` | `/api/pdf/upload` | Uploads PDF, extracts text via Apache PDFBox, and indexes vectors |
| `GET` | `/api/documents` | Retrieves all documents from MySQL |
| `GET` | `/api/documents/{id}` | Gets a specific document by ID |
| `POST` | `/api/documents` | Manually creates and indexes a new document |
| `PUT` | `/api/documents/{id}` | Updates document in MySQL and refreshes ChromaDB vectors |
| `DELETE`| `/api/documents/{id}` | Deletes document from MySQL and purges vectors from ChromaDB |
| `GET` | `/api/documents/search?keyword=...` | MySQL keyword search for dashboard browsing |
| `GET` | `/api/chroma/heartbeat` | Health check for ChromaDB connection |
| `POST` | `/api/chroma/sync` | Re-indexes all existing MySQL documents into ChromaDB |

---

## 📂 Project Directory Structure

```plaintext
AI-powered-knowledge-management-system/
│
├── chroma/                            # ChromaDB local SQLite storage
│   └── chroma.sqlite3
│
├── knowledge-extension/               # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js                     # 15K-character extraction script
│   ├── popup.html
│   └── popup.js
│
└── knowledge-os/                      # Spring Boot 3 Backend
    ├── pom.xml
    └── src/
        └── main/
            ├── java/com/charan/knowledge_os/
            │   ├── ai/
            │   │   ├── OllamaService.java
            │   │   └── OllamaServiceImpl.java      # 8K-char analysis & tagging
            │   ├── controller/
            │   │   ├── ChatController.java         # Semantic RAG chat endpoint
            │   │   ├── DocumentController.java     # Document CRUD
            │   │   ├── WebPageController.java      # Extension ingestion
            │   │   ├── PDFController.java          # PDF upload
            │   │   └── ChromaController.java       # Chroma status & sync
            │   ├── dto/
            │   │   ├── RetrievedChunk.java         # Vector retrieval DTO
            │   │   ├── ChatRequest.java
            │   │   └── ChatResponse.java
            │   ├── entity/
            │   │   └── Document.java               # JPA Entity for MySQL
            │   ├── pdf/
            │   │   └── PDFServiceImpl.java         # Apache PDFBox parser
            │   ├── rag/
            │   │   ├── TextChunker.java            # 1000-char sliding chunker
            │   │   ├── EmbeddingService.java       # Ollama nomic-embed-text
            │   │   ├── ChromaCollectionService.java# Chroma collection manager
            │   │   ├── VectorStoreService.java     # Vector storage & Top-K search
            │   │   └── RAGService.java             # End-to-end RAG pipeline
            │   ├── repository/
            │   │   └── DocumentRepository.java
            │   └── service/
            │       ├── DocumentService.java
            │       └── DocumentServiceImpl.java    # Pipeline orchestrator
            └── resources/
                ├── application.properties          # System configuration
                ├── static/                         # Dashboard JS/CSS assets
                └── templates/                      # Thymeleaf views
```

---

## 💡 Troubleshooting & FAQ

### 1. ChromaDB connection failed (`Connection refused` or `timeout`)
* Make sure ChromaDB is running: `chroma run --path ./chroma --host 127.0.0.1 --port 8000`.
* Check if port 8000 is listening: `curl http://127.0.0.1:8000/api/v2/heartbeat`.
* Ensure `chroma.base-url=http://127.0.0.1:8000` is set in `application.properties`.

### 2. Ollama embedding or chat errors
* Make sure Ollama service is active: `ollama serve`.
* Verify both models are downloaded:
  ```bash
  ollama list
  ```
  If missing, run `ollama pull nomic-embed-text` and `ollama pull llama3.2`.

### 3. MySQL connection refused
* Verify MySQL service is running on port 3306.
* Verify your username and password in `application.properties`.
* Ensure database `knowledge_os` was created: `CREATE DATABASE knowledge_os;`.
