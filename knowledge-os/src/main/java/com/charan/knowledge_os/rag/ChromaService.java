package com.charan.knowledge_os.rag;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class ChromaService {

    private final RestClient client;

    public ChromaService(@Value("${chroma.base-url:http://localhost:8000}") String baseUrl) {

        client = RestClient.builder()
                .baseUrl(baseUrl)
                .build();

    }

    // Add this method here
   public String heartbeat() {

    try {

        return client.get()
                 .uri("/api/v2/heartbeat")
                .retrieve()
                .body(String.class);

    } catch (Exception e) {

        e.printStackTrace();

        return e.toString();
    }

}

}