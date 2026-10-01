package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.rag.ChromaCollectionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chroma")
public class ChromaCollectionController {

    private final ChromaCollectionService service;

    public ChromaCollectionController(ChromaCollectionService service){

        this.service = service;

    }

    @PostMapping("/collection")

    public String createCollection(){

        return service.createCollection();

    }

}