package com.charan.knowledge_os.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AIAnalysisResponse {

    private String title;

    private String summary;

    private String category;

    private List<String> tags;

}