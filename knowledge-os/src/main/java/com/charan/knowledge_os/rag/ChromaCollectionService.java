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
            @Value("${chroma.base-url:http://localhost:8000}") String baseUrl,
            @Value("${chroma.collection.name:knowledge_os}") String defaultCollectionName) {

        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.defaultCollectionName = defaultCollectionName;
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

        String response = client.post()
                .uri("/api/v2/tenants/default_tenant/databases/default_database/collections")
                .body(body)
                .retrieve()
                .body(String.class);

        try {
            JsonNode node = mapper.readTree(response);
            if (node.has("id")) {
                this.cachedCollectionId = node.get("id").asText();
            }
        } catch (Exception e) {
            logger.warn("Could not cache collection ID from response: {}", response);
        }

        return response;
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