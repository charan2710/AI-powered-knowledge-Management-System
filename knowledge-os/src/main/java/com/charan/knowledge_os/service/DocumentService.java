package com.charan.knowledge_os.service;

import com.charan.knowledge_os.entity.Document;

import java.util.List;

public interface DocumentService {

    Document saveDocument(Document document);

    List<Document> getAllDocuments();

    Document getDocumentById(Long id);

    void deleteDocument(Long id);

    Document updateDocument(Long id, Document document);

    List<Document> searchDocuments(String keyword);

    Document analyzeAndSaveDocument(
            String title,
            String content,
            String sourceUrl,
            String sourceName,
            String sourceType);

    Document openDocument(Long id);

    void indexDocumentInVectorStore(Document document);

    void syncAllDocumentsToVectorStore();
}