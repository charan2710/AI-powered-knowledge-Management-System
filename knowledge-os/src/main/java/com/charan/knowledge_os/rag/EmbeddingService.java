package com.charan.knowledge_os.rag;

import com.charan.knowledge_os.dto.EmbeddingRequest;
import com.charan.knowledge_os.dto.EmbeddingResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class EmbeddingService {

    private static final Logger logger = LoggerFactory.getLogger(EmbeddingService.class);
    private final RestClient restClient;
    private final String embeddingModel;

    public EmbeddingService(
            @Value("${spring.ai.ollama.base-url:http://localhost:11434}") String baseUrl,
            @Value("${ollama.embedding.model:nomic-embed-text}") String embeddingModel) {

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.embeddingModel = embeddingModel;
        logger.info("EmbeddingService initialized with baseUrl='{}', model='{}'", baseUrl, embeddingModel);
    }

    public List<Float> generateEmbedding(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Text for embedding generation cannot be empty");
        }

        try {
            EmbeddingRequest request = EmbeddingRequest.builder()
                    .model(embeddingModel)
                    .input(text)
                    .build();

            EmbeddingResponse response = restClient.post()
                    .uri("/api/embed")
                    .body(request)
                    .retrieve()
                    .body(EmbeddingResponse.class);

            if (response != null && response.getEmbeddings() != null && !response.getEmbeddings().isEmpty()) {
                return response.getEmbeddings().get(0);
            }
        } catch (Exception e) {
            logger.warn("Ollama /api/embed endpoint failed ({}), attempting /api/embeddings legacy endpoint...", e.getMessage());
            try {
                Map<String, Object> legacyRequest = Map.of(
                        "model", embeddingModel,
                        "prompt", text
                );
                Map<?, ?> responseMap = restClient.post()
                        .uri("/api/embeddings")
                        .body(legacyRequest)
                        .retrieve()
                        .body(Map.class);

                if (responseMap != null && responseMap.containsKey("embedding")) {
                    List<?> rawList = (List<?>) responseMap.get("embedding");
                    List<Float> floats = new ArrayList<>();
                    for (Object item : rawList) {
                        if (item instanceof Number n) {
                            floats.add(n.floatValue());
                        }
                    }
                    return floats;
                }
            } catch (Exception ex) {
                logger.error("Failed to generate embedding with Ollama model '{}': {}", embeddingModel, ex.getMessage());
                throw new RuntimeException("Embedding generation failed: " + ex.getMessage(), ex);
            }
        }

        throw new RuntimeException("No embedding returned from Ollama for model: " + embeddingModel);
    }

    public List<List<Float>> generateEmbeddings(List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }

        List<List<Float>> result = new ArrayList<>();
        for (String text : texts) {
            result.add(generateEmbedding(text));
        }
        return result;
    }
}