package com.charan.knowledge_os.service;

import com.charan.knowledge_os.dto.DashboardResponse;
import com.charan.knowledge_os.repository.DocumentRepository;
import org.springframework.stereotype.Service;
import com.charan.knowledge_os.dto.CategoryStatsDTO;
@Service
public class DashboardServiceImpl
        implements DashboardService {

    private final DocumentRepository repository;

    public DashboardServiceImpl(
            DocumentRepository repository) {

        this.repository = repository;
    }

    @Override
    public DashboardResponse getDashboard() {
        

       return DashboardResponse.builder()

        .totalDocuments(repository.count())

        .totalCategories(
                repository.findDistinctCategories().size())

        .categoryStats(repository.getCategoryStatistics())
        .recentDocuments(
                repository.findTop5ByOrderByCreatedAtDesc())
        .popularDocuments(
        repository.findTop5ByOrderByVisitCountDesc())
        .build();

    }
}