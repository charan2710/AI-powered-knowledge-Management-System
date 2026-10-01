package com.charan.knowledge_os.dto;
import com.charan.knowledge_os.entity.Document;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardResponse {

    private long totalDocuments;

    private long totalCategories;

    private List<CategoryStatsDTO> categoryStats;
    private List<Document> recentDocuments;
    private List<Document> popularDocuments;
}