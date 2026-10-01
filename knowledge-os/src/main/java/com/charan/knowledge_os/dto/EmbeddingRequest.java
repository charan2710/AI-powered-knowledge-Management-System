package com.charan.knowledge_os.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmbeddingRequest {

    private String model;

    private String input;

}