package com.charan.knowledge_os.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {
    private String message;
    private String question;

    public String getEffectiveMessage() {
        if (message != null && !message.isBlank()) {
            return message;
        }
        return question != null ? question : "";
    }
}
