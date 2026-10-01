package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.dto.ChromaAddRequest;
import com.charan.knowledge_os.rag.VectorStoreService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chroma")
public class ChromaAddController {

    private final VectorStoreService vectorStoreService;

    public ChromaAddController(VectorStoreService vectorStoreService) {
        this.vectorStoreService = vectorStoreService;
    }

    @PostMapping("/add")
    public String add(@RequestBody ChromaAddRequest request) {
        return vectorStoreService.addDocument(request);
    }
}