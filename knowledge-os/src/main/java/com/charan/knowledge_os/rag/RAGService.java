package com.charan.knowledge_os.rag;

import com.charan.knowledge_os.dto.ChatResponse;
import com.charan.knowledge_os.entity.Document;
import com.charan.knowledge_os.repository.DocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RAGService {

    private static final Logger logger = LoggerFactory.getLogger(RAGService.class);

    private final EmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final DocumentRepository documentRepository;
    private final ChatClient chatClient;

    public RAGService(
            EmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            DocumentRepository documentRepository,
            ChatClient.Builder chatClientBuilder
    ) {
        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.documentRepository = documentRepository;
        this.chatClient = chatClientBuilder.build();
    }

    public ChatResponse askKnowledgeBase(String question) {
        if (question == null || question.isBlank()) {
            return ChatResponse.builder()
                    .answer("Please provide a question to ask your knowledge base.")
                    .sources(List.of())
                    .success(false)
                    .build();
        }

        // 1. Retrieve relevant documents from Knowledge Base
        List<Document> matchedDocs = new ArrayList<>();

        // Keyword search in repository
        String[] keywords = question.split("\\s+");
        for (String kw : keywords) {
            if (kw.length() > 2) {
                List<Document> found = documentRepository
                        .findByAiTitleContainingIgnoreCaseOrContentContainingIgnoreCase(kw, kw);
                for (Document d : found) {
                    if (matchedDocs.stream().noneMatch(existing -> existing.getId().equals(d.getId()))) {
                        matchedDocs.add(d);
                    }
                }
            }
        }

        // If no direct keyword match, grab top recent documents as general context
        if (matchedDocs.isEmpty()) {
            matchedDocs = documentRepository.findTop5ByOrderByCreatedAtDesc();
        }

        // Limit to top 5 matched docs for prompt brevity
        List<Document> topDocs = matchedDocs.stream().limit(5).toList();

        List<String> sourceTitles = topDocs.stream()
                .map(d -> d.getAiTitle() != null ? d.getAiTitle() : d.getOriginalTitle())
                .collect(Collectors.toList());

        StringBuilder contextBuilder = new StringBuilder();
        for (Document doc : topDocs) {
            contextBuilder.append("--- Document: ")
                    .append(doc.getAiTitle() != null ? doc.getAiTitle() : doc.getOriginalTitle())
                    .append(" (Category: ").append(doc.getCategory()).append(") ---\n")
                    .append("Summary: ").append(doc.getSummary()).append("\n");

            if (doc.getContent() != null && !doc.getContent().isBlank()) {
                String snippet = doc.getContent().length() > 800
                        ? doc.getContent().substring(0, 800) + "..."
                        : doc.getContent();
                contextBuilder.append("Content excerpt: ").append(snippet).append("\n");
            }
            contextBuilder.append("\n");
        }

        String prompt = """
You are Knowledge OS AI Assistant.
Answer the user's question using ONLY the provided Knowledge Base context below.
If the answer cannot be determined from the context, state that clearly and provide the best related information found in the documents.

Knowledge Base Context:
%s

User Question:
%s
""".formatted(contextBuilder.toString(), question);

        try {
            String answer = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();

            return ChatResponse.builder()
                    .answer(answer)
                    .sources(sourceTitles)
                    .success(true)
                    .build();
        } catch (Exception e) {
            logger.warn("Ollama AI call failed during RAG chat: {}", e.getMessage());

            // Provide fallback answer with matching document summaries
            StringBuilder fallback = new StringBuilder();
            fallback.append("AI generation is currently offline or unreachable. Here are relevant documents from your Knowledge Base:\n\n");
            for (Document d : topDocs) {
                fallback.append("• **")
                        .append(d.getAiTitle() != null ? d.getAiTitle() : d.getOriginalTitle())
                        .append("** (").append(d.getCategory()).append("): ")
                        .append(d.getSummary()).append("\n");
            }

            return ChatResponse.builder()
                    .answer(fallback.toString())
                    .sources(sourceTitles)
                    .success(false)
                    .build();
        }
    }
}