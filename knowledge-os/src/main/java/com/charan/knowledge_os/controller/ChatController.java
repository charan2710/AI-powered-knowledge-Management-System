package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.dto.ChatRequest;
import com.charan.knowledge_os.dto.ChatResponse;
import com.charan.knowledge_os.rag.RAGService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*")
public class ChatController {

    private final RAGService ragService;

    public ChatController(RAGService ragService) {
        this.ragService = ragService;
    }

    @PostMapping
    public ChatResponse chat(@RequestBody ChatRequest request) {
        String query = request != null ? request.getEffectiveMessage() : "";
        return ragService.askKnowledgeBase(query);
    }
}
