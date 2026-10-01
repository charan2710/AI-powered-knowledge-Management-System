package com.charan.knowledge_os.controller;


import com.charan.knowledge_os.pdf.PDFService;
import com.charan.knowledge_os.service.DocumentService;
import com.charan.knowledge_os.entity.Document;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/pdf")
@CrossOrigin(origins = "*")
public class PDFController {

    private final PDFService pdfService;

   
    private final DocumentService documentService;

public PDFController(PDFService pdfService,
                     DocumentService documentService) {

    this.pdfService = pdfService;
    
    this.documentService = documentService;
}

@PostMapping("/upload")
public Document upload(@RequestParam MultipartFile file) {

    String text = pdfService.extractText(file);

    return documentService.analyzeAndSaveDocument(
        file.getOriginalFilename(),
        text,
        "",
        file.getOriginalFilename(),
        "PDF");
}

}