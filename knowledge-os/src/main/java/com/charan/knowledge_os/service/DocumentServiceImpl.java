package com.charan.knowledge_os.service;

import com.charan.knowledge_os.ai.OllamaService;
import com.charan.knowledge_os.dto.AIAnalysisResponse;
import com.charan.knowledge_os.entity.Document;
import com.charan.knowledge_os.rag.EmbeddingService;
import com.charan.knowledge_os.rag.TextChunker;
import com.charan.knowledge_os.rag.VectorStoreService;
import com.charan.knowledge_os.repository.DocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DocumentServiceImpl implements DocumentService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentServiceImpl.class);

    private final DocumentRepository repository;
    private final OllamaService ollamaService;
    private final EmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final TextChunker textChunker;
    private final int maxExtractionLength;

    public DocumentServiceImpl(
            DocumentRepository repository,
            OllamaService ollamaService,
            EmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            TextChunker textChunker,
            @Value("${rag.max-extraction-length:15000}") int maxExtractionLength) {

        this.repository = repository;
        this.ollamaService = ollamaService;
        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.textChunker = textChunker;
        this.maxExtractionLength = maxExtractionLength > 0 ? maxExtractionLength : 15000;
    }

    @Override
    public Document saveDocument(Document document) {
        if (document.getContent() != null && document.getContent().length() > maxExtractionLength) {
            logger.info("Applying 15K-character extraction limit: truncating content from {} to {} chars",
                    document.getContent().length(), maxExtractionLength);
            document.setContent(document.getContent().substring(0, maxExtractionLength));
        }

        logger.info("Saving document to MySQL: {}",
                document.getAiTitle() != null ? document.getAiTitle() : document.getOriginalTitle());

        if (document.getCreatedAt() == null) {
            document.setCreatedAt(LocalDateTime.now());
        }

        Document saved = repository.save(document);
        logger.info("Document saved in MySQL with ID: {}", saved.getId());

        // Ingest into ChromaDB vector store
        indexDocumentInVectorStore(saved);

        return saved;
    }

    @Override
    public Document analyzeAndSaveDocument(
            String title,
            String content,
            String sourceUrl,
            String sourceName,
            String sourceType) {

        // 1. Apply 15,000-character extraction limit
        String processedContent = content != null ? content : "";
        if (processedContent.length() > maxExtractionLength) {
            logger.info("Applying 15K-character extraction limit on {} ingestion: truncated from {} to {} chars",
                    sourceType, processedContent.length(), maxExtractionLength);
            processedContent = processedContent.substring(0, maxExtractionLength);
        }

        // 2. AI analysis (OllamaService applies its 8K-character analysis limit)
        String aiInput = """
Document Title:
%s

Document Content:
%s
""".formatted(title, processedContent);

        AIAnalysisResponse ai;
        try {
            ai = ollamaService.analyzeDocument(aiInput);
        } catch (Exception e) {
            logger.warn("Ollama AI analysis failed: {}. Using fallback metadata.", e.getMessage());
            ai = AIAnalysisResponse.builder()
                    .title(title != null && !title.isBlank() ? title : "Untitled Document")
                    .summary(processedContent.length() > 300 ? processedContent.substring(0, 300) + "..." : processedContent)
                    .category("General")
                    .tags(List.of("knowledge"))
                    .build();
        }

        // 3. Persist in MySQL (source of truth)
        Document document = Document.builder()
                .originalTitle(title != null && !title.isBlank() ? title : ai.getTitle())
                .aiTitle(ai.getTitle())
                .content(processedContent)
                .summary(ai.getSummary())
                .category(ai.getCategory())
                .tags(ai.getTags() != null ? String.join(",", ai.getTags()) : "")
                .sourceUrl(sourceUrl)
                .sourceName(sourceName)
                .sourceType(sourceType)
                .visitCount(1)
                .createdAt(LocalDateTime.now())
                .lastOpened(LocalDateTime.now())
                .build();

        Document saved = repository.save(document);
        logger.info("Document saved in MySQL with ID: {}", saved.getId());

        // 4. Chunk, embed with Ollama, and store vectors in ChromaDB
        indexDocumentInVectorStore(saved);

        return saved;
    }

    @Override
    public Document updateDocument(Long id, Document document) {
        Document existing = getDocumentById(id);

        String updatedContent = document.getContent();
        if (updatedContent != null && updatedContent.length() > maxExtractionLength) {
            logger.info("Applying 15K-character extraction limit on update: truncated from {} to {} chars",
                    updatedContent.length(), maxExtractionLength);
            updatedContent = updatedContent.substring(0, maxExtractionLength);
        }

        existing.setOriginalTitle(document.getOriginalTitle());
        existing.setAiTitle(document.getAiTitle());
        existing.setContent(updatedContent);
        existing.setSummary(document.getSummary());
        existing.setCategory(document.getCategory());
        existing.setSourceType(document.getSourceType());

        Document saved = repository.save(existing);
        logger.info("Updated document {} in MySQL", id);

        // Delete existing vectors and re-index new chunks
        try {
            logger.info("Refreshing ChromaDB embeddings for updated document ID: {}", id);
            vectorStoreService.deleteByDocumentId(id);
            indexDocumentInVectorStore(saved);
        } catch (Exception e) {
            logger.error("Failed to refresh ChromaDB vectors for document ID {}: {}", id, e.getMessage());
        }

        return saved;
    }

    @Override
    public void deleteDocument(Long id) {
        repository.deleteById(id);
        logger.info("Deleted document {} from MySQL", id);

        // Remove corresponding vectors from ChromaDB
        try {
            vectorStoreService.deleteByDocumentId(id);
        } catch (Exception e) {
            logger.error("Failed to delete vectors from ChromaDB for document ID {}: {}", id, e.getMessage());
        }
    }

    @Override
    public void indexDocumentInVectorStore(Document document) {
        if (document == null || document.getId() == null) {
            return;
        }

        String content = document.getContent();
        if (content == null || content.isBlank()) {
            logger.debug("Skipping vector indexing for document ID {} due to empty content", document.getId());
            return;
        }

        try {
            // Chunk document
            List<String> chunks = textChunker.chunkText(content);
            if (chunks.isEmpty()) {
                return;
            }

            logger.info("Generating embeddings for {} chunks of document ID: {}", chunks.size(), document.getId());
            List<List<Float>> embeddings = embeddingService.generateEmbeddings(chunks);

            String title = document.getAiTitle() != null && !document.getAiTitle().isBlank()
                    ? document.getAiTitle()
                    : document.getOriginalTitle();

            vectorStoreService.storeChunks(
                    document.getId(),
                    title,
                    document.getSourceUrl(),
                    document.getSourceName(),
                    document.getCategory(),
                    chunks,
                    embeddings
            );

        } catch (Exception e) {
            logger.warn("Vector indexing for document ID {} failed: {}. MySQL record remains intact.",
                    document.getId(), e.getMessage());
        }
    }

    @Override
    public void syncAllDocumentsToVectorStore() {
        List<Document> allDocs = repository.findAll();
        logger.info("Starting synchronization of {} documents to ChromaDB...", allDocs.size());
        for (Document doc : allDocs) {
            indexDocumentInVectorStore(doc);
        }
        logger.info("Synchronization to ChromaDB complete.");
    }

    @Override
    public List<Document> getAllDocuments() {
        return repository.findAll();
    }

    @Override
    public Document getDocumentById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found with ID: " + id));
    }

    @Override
    public List<Document> searchDocuments(String keyword) {
        // Preserves MySQL keyword search for normal dashboard/document search
        return repository.findByAiTitleContainingIgnoreCaseOrContentContainingIgnoreCase(
                keyword,
                keyword
        );
    }

    @Override
    public Document openDocument(Long id) {
        Document document = getDocumentById(id);
        document.setVisitCount(document.getVisitCount() + 1);
        document.setLastOpened(LocalDateTime.now());
        return repository.save(document);
    }
}