package com.charan.knowledge_os.repository;

import com.charan.knowledge_os.dto.CategoryStatsDTO;
import com.charan.knowledge_os.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;


import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

  List<Document>
findByAiTitleContainingIgnoreCaseOrContentContainingIgnoreCase(
        String aiTitle,
        String content);;
long count();

List<Document> findAll();
@Query("SELECT DISTINCT d.category FROM Document d")
List<String> findDistinctCategories();
List<Document> findTop5ByOrderByCreatedAtDesc();
List<Document> findTop5ByOrderByVisitCountDesc();
@Query("""
SELECT new com.charan.knowledge_os.dto.CategoryStatsDTO(
    d.category,
    COUNT(d)
)
FROM Document d
GROUP BY d.category
ORDER BY COUNT(d) DESC
""")
List<CategoryStatsDTO> getCategoryStatistics();
}