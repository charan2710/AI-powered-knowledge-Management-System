package com.charan.knowledge_os.rag;

import com.charan.knowledge_os.dto.EmbeddingRequest;
import com.charan.knowledge_os.dto.EmbeddingResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class EmbeddingService {

    private final RestClient restClient;

    public EmbeddingService() {

        this.restClient = RestClient.builder()
                .baseUrl("http://localhost:11434")
                .build();

    }

    public List<Float> generateEmbedding(String text){

        EmbeddingRequest request =
                EmbeddingRequest.builder()
                        .model("nomic-embed-text")
                        .input(text)
                        .build();

        EmbeddingResponse response =
                restClient.post()
                        .uri("/api/embed")
                        .body(request)
                        .retrieve()
                        .body(EmbeddingResponse.class);

        return response.getEmbeddings().get(0);

    }

}