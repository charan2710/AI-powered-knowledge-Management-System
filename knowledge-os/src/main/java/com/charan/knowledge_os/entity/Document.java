package com.charan.knowledge_os.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // AI Generated
    // Original title from PDF or Webpage
private String originalTitle;

// AI-generated cleaner title
private String aiTitle;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column(columnDefinition = "LONGTEXT")
    private String summary;

    private String category;

    @Column(columnDefinition = "TEXT")
    private String tags;

    // Source Information
    private String sourceUrl;

    private String sourceName;

    private String sourceType;

    // User Analytics
    private int visitCount;

    private LocalDateTime createdAt;

    private LocalDateTime lastOpened;
}