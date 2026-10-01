package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.dto.WebPageRequest;
import com.charan.knowledge_os.entity.Document;
import com.charan.knowledge_os.service.DocumentService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/webpage")
@CrossOrigin(origins = "*")
public class WebPageController {

    private final DocumentService documentService;

    public WebPageController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping("/save")
    public Document savePage(
            @RequestBody WebPageRequest request) {

      return documentService.analyzeAndSaveDocument(
        request.getTitle(),
        request.getContent(),
        request.getUrl(),
        request.getWebsite(),
        "Website");
    }
}