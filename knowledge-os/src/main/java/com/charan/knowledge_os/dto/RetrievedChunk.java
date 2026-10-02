package com.charan.knowledge_os.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RetrievedChunk {

    private String chunkId;

    private Long documentId;

    private String text;

    private String title;

    private String sourceUrl;

    private String sourceName;

    private String category;

    private Double distance;
}
