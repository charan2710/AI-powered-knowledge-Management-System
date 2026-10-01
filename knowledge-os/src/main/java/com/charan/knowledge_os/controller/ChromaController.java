package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.rag.ChromaService;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/chroma")
public class ChromaController {

    private final ChromaService service;

    public ChromaController(ChromaService service){

        this.service = service;

    }

    @GetMapping("/heartbeat")
    public String heartbeat(){

        return service.heartbeat();

    }

}