package com.charan.knowledge_os.pdf;

import org.springframework.web.multipart.MultipartFile;

public interface PDFService {

    String extractText(MultipartFile file);

}