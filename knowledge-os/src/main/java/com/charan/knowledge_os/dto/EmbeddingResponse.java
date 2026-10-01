package com.charan.knowledge_os.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmbeddingResponse {

    private String model;

    private List<List<Float>> embeddings;

    private Long total_duration;

    private Long load_duration;

    private Integer prompt_eval_count;

}