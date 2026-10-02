package com.charan.knowledge_os.rag;

import com.charan.knowledge_os.dto.RetrievedChunk;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;

@Service
public class VectorStoreService {

    private static final Logger logger = LoggerFactory.getLogger(VectorStoreService.class);
    private final RestClient client;
    private final ChromaCollectionService collectionService;
    private final ObjectMapper mapper = new ObjectMapper();

    public VectorStoreService(
            @Value("${chroma.base-url:http://127.0.0.1:8000}") String baseUrl,
            ChromaCollectionService collectionService) {

        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.collectionService = collectionService;
    }

    public void storeChunks(
            Long documentId,
            String title,
            String sourceUrl,
            String sourceName,
            String category,
            List<String> chunks,
            List<List<Float>> embeddings) {

        if (chunks == null || chunks.isEmpty()) {
            logger.warn("storeChunks called with empty chunks for documentId: {}", documentId);
            return;
        }

        if (embeddings == null || embeddings.size() != chunks.size()) {
            throw new IllegalArgumentException("Embeddings count must match chunks count");
        }

        List<String> ids = new ArrayList<>();
        List<Map<String, Object>> metadatas = new ArrayList<>();

        for (int i = 0; i < chunks.size(); i++) {
            String chunkId = "doc_" + documentId + "_chunk_" + i;
            ids.add(chunkId);

            Map<String, Object> meta = new HashMap<>();
            meta.put("documentId", documentId);
            meta.put("chunkId", chunkId);
            meta.put("title", title != null ? title : "");
            meta.put("sourceUrl", sourceUrl != null ? sourceUrl : "");
            meta.put("sourceName", sourceName != null ? sourceName : "");
            meta.put("category", category != null ? category : "");
            metadatas.add(meta);
        }

        Map<String, Object> body = Map.of(
                "ids", ids,
                "embeddings", embeddings,
                "documents", chunks,
                "metadatas", metadatas
        );

        String collectionId = collectionService.getOrCreateCollectionId();
        logger.info("Storing {} chunks for documentId: {} in Chroma collection: {}", chunks.size(), documentId, collectionId);

        try {
            client.post()
                    .uri("/api/v2/tenants/default_tenant/databases/default_database/collections/" + collectionId + "/add")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            logger.info("Successfully stored {} chunks for documentId: {} in ChromaDB", chunks.size(), documentId);
        } catch (Exception e) {
            logger.warn("Chroma add failed ({}), invalidating collection cache and retrying...", e.getMessage());
            collectionService.invalidateCache();
            String refreshedId = collectionService.getOrCreateCollectionId();
            try {
                client.post()
                        .uri("/api/v2/tenants/default_tenant/databases/default_database/collections/" + refreshedId + "/add")
                        .body(body)
                        .retrieve()
                        .toBodilessEntity();
                logger.info("Successfully stored {} chunks for documentId: {} in ChromaDB on retry", chunks.size(), documentId);
            } catch (Exception retryEx) {
                logger.error("Failed to store chunks in ChromaDB for documentId {}: {}", documentId, retryEx.getMessage());
                throw new RuntimeException("ChromaDB vector storage failed: " + retryEx.getMessage(), retryEx);
            }
        }
    }

    public List<RetrievedChunk> searchSimilar(List<Float> queryEmbedding, int topK) {
        if (queryEmbedding == null || queryEmbedding.isEmpty()) {
            logger.warn("searchSimilar called with empty queryEmbedding");
            return Collections.emptyList();
        }

        String collectionId;
        try {
            collectionId = collectionService.getOrCreateCollectionId();
        } catch (Exception e) {
            logger.error("Failed to get Chroma collection for similarity search: {}", e.getMessage());
            return Collections.emptyList();
        }

        int k = topK > 0 ? topK : 5;
        logger.info("Searching ChromaDB collection {} for top-{} similar chunks", collectionId, k);

        Map<String, Object> body = Map.of(
                "query_embeddings", List.of(queryEmbedding),
                "n_results", k,
                "include", List.of("documents", "metadatas", "distances")
        );

        try {
            String responseStr = client.post()
                    .uri("/api/v2/tenants/default_tenant/databases/default_database/collections/" + collectionId + "/query")
                    .body(body)
                    .retrieve()
                    .body(String.class);

            if (responseStr == null || responseStr.isBlank()) {
                return Collections.emptyList();
            }

            JsonNode root = mapper.readTree(responseStr);
            JsonNode idsArray = root.path("ids").path(0);
            JsonNode docsArray = root.path("documents").path(0);
            JsonNode metasArray = root.path("metadatas").path(0);
            JsonNode distsArray = root.path("distances").path(0);

            List<RetrievedChunk> results = new ArrayList<>();
            int size = idsArray.size();

            for (int i = 0; i < size; i++) {
                String chunkId = idsArray.path(i).asText();
                String text = docsArray.path(i).asText();
                Double distance = distsArray.path(i).isNumber() ? distsArray.path(i).asDouble() : null;
                JsonNode meta = metasArray.path(i);

                Long docId = meta.path("documentId").isNumber() ? meta.path("documentId").asLong() : null;
                String title = meta.path("title").asText("");
                String sourceUrl = meta.path("sourceUrl").asText("");
                String sourceName = meta.path("sourceName").asText("");
                String category = meta.path("category").asText("");

                RetrievedChunk chunk = RetrievedChunk.builder()
                        .chunkId(chunkId)
                        .documentId(docId)
                        .text(text)
                        .title(title)
                        .sourceUrl(sourceUrl)
                        .sourceName(sourceName)
                        .category(category)
                        .distance(distance)
                        .build();

                results.add(chunk);
            }

            logger.info("ChromaDB returned {} similar chunks", results.size());
            return results;
        } catch (Exception e) {
            logger.error("ChromaDB similarity search query failed: {}", e.getMessage());
            collectionService.invalidateCache();
            return Collections.emptyList();
        }
    }

    public void deleteByDocumentId(Long documentId) {
        if (documentId == null) {
            return;
        }

        try {
            String collectionId = collectionService.getOrCreateCollectionId();
            logger.info("Deleting Chroma vectors for documentId: {} in collection: {}", documentId, collectionId);

            Map<String, Object> body = Map.of(
                    "where", Map.of("documentId", documentId)
            );

            client.post()
                    .uri("/api/v2/tenants/default_tenant/databases/default_database/collections/" + collectionId + "/delete")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            logger.info("Successfully deleted vectors for documentId: {}", documentId);
        } catch (Exception e) {
            logger.warn("Failed to delete vectors for documentId {} from ChromaDB (might not exist): {}", documentId, e.getMessage());
            collectionService.invalidateCache();
        }
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