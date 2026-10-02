package com.charan.knowledge_os.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
public class ChromaCollectionService {

    private static final Logger logger = LoggerFactory.getLogger(ChromaCollectionService.class);
    private final RestClient client;
    private final String defaultCollectionName;
    private final ObjectMapper mapper = new ObjectMapper();
    private volatile String cachedCollectionId;

    public ChromaCollectionService(
            @Value("${chroma.base-url:http://127.0.0.1:8000}") String baseUrl,
            @Value("${chroma.collection.name:knowledge_documents}") String defaultCollectionName) {

        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.defaultCollectionName = defaultCollectionName;
    }

    public void invalidateCache() {
        this.cachedCollectionId = null;
    }

    public String createCollection() {
        return createCollection(defaultCollectionName);
    }

    public String createCollection(String name) {
        logger.info("Ensuring Chroma collection exists: {}", name);

        Map<String, Object> body = Map.of(
                "name", name,
                "get_or_create", true
        );

        try {
            String response = client.post()
                    .uri("/api/v2/tenants/default_tenant/databases/default_database/collections")
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode node = mapper.readTree(response);
            if (node.has("id")) {
                this.cachedCollectionId = node.get("id").asText();
                logger.info("Chroma collection '{}' ready with ID: {}", name, this.cachedCollectionId);
            }
            return response;
        } catch (Exception e) {
            logger.warn("Chroma collection creation/lookup via POST failed: {}. Attempting GET fallback...", e.getMessage());
            try {
                String response = client.get()
                        .uri("/api/v2/tenants/default_tenant/databases/default_database/collections/" + name)
                        .retrieve()
                        .body(String.class);

                JsonNode node = mapper.readTree(response);
                if (node.has("id")) {
                    this.cachedCollectionId = node.get("id").asText();
                    logger.info("Chroma collection '{}' found via GET with ID: {}", name, this.cachedCollectionId);
                }
                return response;
            } catch (Exception ex) {
                logger.error("Failed to ensure Chroma collection '{}': {}", name, ex.getMessage());
                throw new RuntimeException("Unable to initialize Chroma collection '" + name + "': " + ex.getMessage(), ex);
            }
        }
    }

    public String getOrCreateCollectionId() {
        if (cachedCollectionId != null) {
            return cachedCollectionId;
        }

        createCollection(defaultCollectionName);
        if (cachedCollectionId != null) {
            return cachedCollectionId;
        }

        throw new RuntimeException("Unable to retrieve or create Chroma collection ID for: " + defaultCollectionName);
    }
}