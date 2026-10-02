package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.rag.ChromaService;
import com.charan.knowledge_os.service.DocumentService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chroma")
@CrossOrigin(origins = "*")
public class ChromaController {

    private final ChromaService service;
    private final DocumentService documentService;

    public ChromaController(ChromaService service, DocumentService documentService){
        this.service = service;
        this.documentService = documentService;
    }

    @GetMapping("/heartbeat")
    public String heartbeat(){
        return service.heartbeat();
    }

    @PostMapping("/sync")
    public Map<String, Object> syncAll(){
        documentService.syncAllDocumentsToVectorStore();
        return Map.of("success", true, "message", "All documents synced to ChromaDB vector store");
    }
}