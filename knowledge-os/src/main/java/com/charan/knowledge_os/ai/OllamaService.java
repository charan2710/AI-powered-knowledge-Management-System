package com.charan.knowledge_os.ai;

import com.charan.knowledge_os.dto.AIAnalysisResponse;

public interface OllamaService {

   AIAnalysisResponse analyzeDocument(String content);
}
