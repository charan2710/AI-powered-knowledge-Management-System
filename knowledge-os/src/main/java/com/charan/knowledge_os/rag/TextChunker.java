package com.charan.knowledge_os.rag;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class TextChunker {

    private final int defaultChunkSize;
    private final int defaultChunkOverlap;

    public TextChunker(
            @Value("${rag.chunk-size:1000}") int defaultChunkSize,
            @Value("${rag.chunk-overlap:150}") int defaultChunkOverlap) {
        this.defaultChunkSize = defaultChunkSize;
        this.defaultChunkOverlap = defaultChunkOverlap;
    }

    public List<String> chunkText(String text) {
        return chunkText(text, defaultChunkSize, defaultChunkOverlap);
    }

    public List<String> chunkText(String text, int chunkSize, int overlap) {
        if (text == null || text.isBlank()) {
            return Collections.emptyList();
        }

        String cleaned = text.trim();
        if (cleaned.length() <= chunkSize) {
            return List.of(cleaned);
        }

        List<String> chunks = new ArrayList<>();
        int start = 0;
        int length = cleaned.length();

        while (start < length) {
            int end = Math.min(start + chunkSize, length);

            // Break at natural paragraph or sentence boundary if available
            if (end < length) {
                int lastNewline = cleaned.lastIndexOf('\n', end);
                if (lastNewline > start + (chunkSize / 2)) {
                    end = lastNewline + 1;
                } else {
                    int lastPeriod = cleaned.lastIndexOf(". ", end);
                    if (lastPeriod > start + (chunkSize / 2)) {
                        end = lastPeriod + 1;
                    }
                }
            }

            String chunk = cleaned.substring(start, end).trim();
            if (!chunk.isEmpty()) {
                chunks.add(chunk);
            }

            if (end >= length) {
                break;
            }

            start = Math.max(start + 1, end - overlap);
        }

        return chunks;
    }
}
