package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.rag.EmbeddingService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/embed")
public class EmbeddingController {

    private final EmbeddingService embeddingService;

    public EmbeddingController(EmbeddingService embeddingService) {

        this.embeddingService = embeddingService;

    }

    @PostMapping
    public List<Float> embed(@RequestBody String text){

        return embeddingService.generateEmbedding(text);

    }

}