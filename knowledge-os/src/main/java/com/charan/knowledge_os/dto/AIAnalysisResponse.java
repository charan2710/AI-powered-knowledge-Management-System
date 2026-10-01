package com.charan.knowledge_os.dto;

import lombok.Data;
import java.util.List;

@Data
public class AIAnalysisResponse {

    private String title;

    private String summary;

    private String category;

    private List<String> tags;

}