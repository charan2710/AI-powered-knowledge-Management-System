package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.dto.ApiResponse;
import com.charan.knowledge_os.dto.DocumentRequest;
import com.charan.knowledge_os.entity.Document;
import com.charan.knowledge_os.service.DocumentService;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "*")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

   @PostMapping
public ApiResponse<Document> createDocument(
        @Valid @RequestBody DocumentRequest request) {

   Document document = Document.builder()
        .originalTitle(request.getTitle())
        .aiTitle(request.getTitle())   // Temporary for manually created documents
        .content(request.getContent())
        .summary(request.getSummary())
        .category(request.getCategory())
        .sourceType(request.getSourceType())
        .build();

   Document saved = service.saveDocument(document);

return ApiResponse.<Document>builder()
        .success(true)
        .message("Document created successfully")
        .data(saved)
        .build();
}

    @GetMapping
    public List<Document> getAllDocuments() {

        return service.getAllDocuments();
    }

    @GetMapping("/{id}")
    public Document getDocumentById(
            @PathVariable Long id) {

        return service.getDocumentById(id);
    }

    @DeleteMapping("/{id}")
    public String deleteDocument(
            @PathVariable Long id) {

        service.deleteDocument(id);

        return "Document deleted successfully";
    }

    @GetMapping("/search")
    public List<Document> searchDocuments(
            @RequestParam String keyword) {

        return service.searchDocuments(keyword);
    }
    @PutMapping("/{id}")
public Document updateDocument(
        @PathVariable Long id,
        @RequestBody Document document) {

    return service.updateDocument(
            id,
            document);
}
@GetMapping("/open/{id}")
public Document openDocument(
        @PathVariable Long id) {

    return service.openDocument(id);

}
}