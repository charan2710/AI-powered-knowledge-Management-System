package com.charan.knowledge_os.service;

import com.charan.knowledge_os.dto.AIAnalysisResponse;
import com.charan.knowledge_os.entity.Document;
import com.charan.knowledge_os.repository.DocumentRepository;
import org.springframework.stereotype.Service;
import com.charan.knowledge_os.ai.OllamaService;
import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class DocumentServiceImpl implements DocumentService {

    private final DocumentRepository repository;
    private final OllamaService ollamaService;
    private static final Logger logger =
        LoggerFactory.getLogger(DocumentServiceImpl.class);

    public DocumentServiceImpl(DocumentRepository repository, OllamaService ollamaService) {
        this.repository = repository;
        this.ollamaService = ollamaService;
    }
    @Override
public Document updateDocument(
        Long id,
        Document document) {

    Document existing =
            getDocumentById(id);

    existing.setOriginalTitle(document.getOriginalTitle());
existing.setAiTitle(document.getAiTitle());
existing.setContent(document.getContent());
existing.setSummary(document.getSummary());
existing.setCategory(document.getCategory());
existing.setSourceType(document.getSourceType());

    return repository.save(existing);
}

    @Override
    public Document saveDocument(Document document) {

      logger.info(
        "Saving document: {}",
        document.getAiTitle() != null
                ? document.getAiTitle()
                : document.getOriginalTitle());

document.setCreatedAt(LocalDateTime.now());

Document saved = repository.save(document);

logger.info("Document saved successfully with ID: {}", saved.getId());

return saved;
    }

    @Override
    public List<Document> getAllDocuments() {
        return repository.findAll();
    }

    @Override
    public Document getDocumentById(Long id) {

        return repository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Document not found"));
    }

    @Override
    public void deleteDocument(Long id) {

        repository.deleteById(id);
    }

  @Override
public List<Document> searchDocuments(
        String keyword) {

    return repository
            .findByAiTitleContainingIgnoreCaseOrContentContainingIgnoreCase(
                    keyword,
                    keyword);
}
@Override
public Document analyzeAndSaveDocument(
        String title,
        String content,
        String sourceUrl,
        String sourceName,
        String sourceType){

    String aiInput = """
Document Title:
%s

Document Content:
%s
""".formatted(title != null ? title : "", content != null ? content : "");

    AIAnalysisResponse ai;
    try {
        ai = ollamaService.analyzeDocument(aiInput);
        if (ai == null) {
            throw new RuntimeException("AI response returned null");
        }
    } catch (Exception e) {
        logger.warn("AI analysis failed for document '{}'. Using fallback metadata. Error: {}", title, e.getMessage());
        ai = new AIAnalysisResponse();
        ai.setTitle(title != null && !title.isBlank() ? title : "Untitled " + (sourceType != null ? sourceType : "Document"));
        String excerpt = (content != null && !content.isBlank())
                ? (content.length() > 250 ? content.substring(0, 250).replaceAll("\\s+", " ").trim() + "..." : content.trim())
                : "No content summary available.";
        ai.setSummary(excerpt);
        ai.setCategory(sourceType != null && !sourceType.isBlank() ? sourceType : "General");
        ai.setTags(List.of("Saved", sourceType != null ? sourceType : "Doc"));
    }

    String resolvedOriginalTitle = (title != null && !title.isBlank()) ? title : ai.getTitle();
    String resolvedAiTitle = (ai.getTitle() != null && !ai.getTitle().isBlank()) ? ai.getTitle() : resolvedOriginalTitle;
    String resolvedSummary = (ai.getSummary() != null && !ai.getSummary().isBlank()) ? ai.getSummary() : "No summary available";
    String resolvedCategory = (ai.getCategory() != null && !ai.getCategory().isBlank()) ? ai.getCategory() : "General";
    String resolvedTags = (ai.getTags() != null && !ai.getTags().isEmpty()) ? String.join(",", ai.getTags()) : "General";

    Document document = Document.builder()
        .originalTitle(resolvedOriginalTitle)
        .aiTitle(resolvedAiTitle)
        .content(content)
        .summary(resolvedSummary)
        .category(resolvedCategory)
        .tags(resolvedTags)
        .sourceUrl(sourceUrl != null ? sourceUrl : "")
        .sourceName(sourceName != null ? sourceName : "")
        .sourceType(sourceType != null ? sourceType : "Document")
        .visitCount(1)
        .createdAt(LocalDateTime.now())
        .lastOpened(LocalDateTime.now())
        .build();

    return repository.save(document);
}

@Override
public Document openDocument(Long id) {

    Document document = repository.findById(id)
            .orElseThrow(() ->
                    new RuntimeException("Document not found with ID: " + id));

    document.setVisitCount(document.getVisitCount() + 1);
    document.setLastOpened(LocalDateTime.now());

    return repository.save(document);
}
}