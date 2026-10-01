package com.charan.knowledge_os.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChromaAddRequest {

    private List<String> ids;

    private List<List<Float>> embeddings;

    private List<String> documents;

    private List<Map<String,Object>> metadatas;

}