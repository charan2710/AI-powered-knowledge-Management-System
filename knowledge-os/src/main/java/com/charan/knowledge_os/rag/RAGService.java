package com.charan.knowledge_os.rag;

import com.charan.knowledge_os.dto.ChatResponse;
import com.charan.knowledge_os.dto.RetrievedChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class RAGService {

    private static final Logger logger = LoggerFactory.getLogger(RAGService.class);

    private final EmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final ChatClient chatClient;
    private final int topK;

    public RAGService(
            EmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            ChatClient.Builder chatClientBuilder,
            @Value("${rag.top-k:5}") int topK) {

        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.chatClient = chatClientBuilder.build();
        this.topK = topK > 0 ? topK : 5;
    }

    public String answerQuestion(String question) {
        ChatResponse response = askKnowledgeBase(question);
        return response.getAnswer();
    }

    public ChatResponse askKnowledgeBase(String question) {
        if (question == null || question.isBlank()) {
            return ChatResponse.builder()
                    .answer("Please provide a question to ask your knowledge base.")
                    .sources(List.of())
                    .success(false)
                    .build();
        }

        List<RetrievedChunk> chunks = List.of();

        try {
            // 1. Generate query embedding
            logger.info("Generating query embedding for question...");
            List<Float> queryEmbedding = embeddingService.generateEmbedding(question);

            // 2. Search ChromaDB using the query vector
            logger.info("Searching ChromaDB for top-{} semantic chunks...", topK);
            chunks = vectorStoreService.searchSimilar(queryEmbedding, topK);
            logger.info("Retrieved {} semantic chunks from ChromaDB", chunks.size());

        } catch (Exception e) {
            logger.error("Semantic search failed via ChromaDB/Ollama embeddings: {}", e.getMessage());
        }

        if (chunks.isEmpty()) {
            return ChatResponse.builder()
                    .answer("I could not find any relevant information in your Knowledge Base to answer this question. Please ensure relevant documents have been added and indexed.")
                    .sources(List.of())
                    .success(false)
                    .build();
        }

        // 3. Collect distinct source titles for citation
        Set<String> sourceTitleSet = new LinkedHashSet<>();
        for (RetrievedChunk chunk : chunks) {
            if (chunk.getTitle() != null && !chunk.getTitle().isBlank()) {
                sourceTitleSet.add(chunk.getTitle());
            }
        }
        List<String> sourceTitles = new ArrayList<>(sourceTitleSet);

        // 4. Build context
        logger.info("Building RAG context from {} retrieved chunks...", chunks.size());
        StringBuilder contextBuilder = new StringBuilder();
        for (int i = 0; i < chunks.size(); i++) {
            RetrievedChunk c = chunks.get(i);
            contextBuilder.append("--- Excerpt ").append(i + 1)
                    .append(" (Source: ").append(c.getTitle())
                    .append(c.getCategory() != null && !c.getCategory().isBlank() ? ", Category: " + c.getCategory() : "")
                    .append(") ---\n")
                    .append(c.getText()).append("\n\n");
        }

        String prompt = """
You are an AI assistant for a personal knowledge management system called Knowledge OS.
Use the following retrieved knowledge to answer the user's question.

Retrieved Context:
%s

User Question:
%s

Instructions:
- Answer using ONLY the provided context.
- Do not invent information that is not supported by the context.
- If the retrieved context does not contain enough information to answer the question, clearly state that.
- Be concise, accurate, and professional.
""".formatted(contextBuilder.toString(), question);

        // 5. Send context + question to Ollama
        logger.info("Sending context to Ollama LLM...");
        try {
            String answer = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();

            logger.info("RAG response generated successfully");

            return ChatResponse.builder()
                    .answer(answer)
                    .sources(sourceTitles)
                    .success(true)
                    .build();

        } catch (Exception e) {
            logger.warn("Ollama LLM call failed during RAG response generation: {}", e.getMessage());

            // Graceful fallback with retrieved semantic excerpts
            StringBuilder fallback = new StringBuilder();
            fallback.append("AI text generation is currently unavailable. Here are the top semantically retrieved excerpts from your Knowledge Base:\n\n");
            for (RetrievedChunk c : chunks) {
                fallback.append("• **").append(c.getTitle()).append("**:\n")
                        .append(c.getText()).append("\n\n");
            }

            return ChatResponse.builder()
                    .answer(fallback.toString())
                    .sources(sourceTitles)
                    .success(false)
                    .build();
        }
    }
}