package com.charan.knowledge_os.rag;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class VectorStoreService {

    private static final Logger logger = LoggerFactory.getLogger(VectorStoreService.class);
    private final RestClient client;
    private final ChromaCollectionService collectionService;

    public VectorStoreService(
            @Value("${chroma.base-url:http://localhost:8000}") String baseUrl,
            ChromaCollectionService collectionService) {

        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.collectionService = collectionService;
    }

    public String addDocument(Object request) {
        String collectionId = collectionService.getOrCreateCollectionId();
        logger.info("Adding documents to Chroma collection: {}", collectionId);

        return client.post()
                .uri("/api/v2/tenants/default_tenant/databases/default_database/collections/" + collectionId + "/add")
                .body(request)
                .retrieve()
                .body(String.class);
    }
}