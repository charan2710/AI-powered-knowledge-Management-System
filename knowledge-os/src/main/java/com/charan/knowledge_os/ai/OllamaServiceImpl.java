package com.charan.knowledge_os.ai;

import com.charan.knowledge_os.dto.AIAnalysisResponse;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OllamaServiceImpl implements OllamaService {

    private static final Logger logger = LoggerFactory.getLogger(OllamaServiceImpl.class);
    private static final int MAX_INPUT_LENGTH = 8000;

    private final ChatClient chatClient;
    private final ObjectMapper mapper;

    public OllamaServiceImpl(ChatClient.Builder builder) {
        this.chatClient = builder.build();
        this.mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    AIAnalysisResponse convertJsonToObject(String rawResponse) {
        if (rawResponse == null || rawResponse.isBlank()) {
            throw new RuntimeException("AI response is empty");
        }

        String cleaned = rawResponse.trim();

        // 1. Remove markdown code blocks ```json ... ``` or ``` ... ```
        if (cleaned.startsWith("```")) {
            int firstNewline = cleaned.indexOf("\n");
            if (firstNewline != -1) {
                cleaned = cleaned.substring(firstNewline + 1);
            }
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.lastIndexOf("```"));
            }
            cleaned = cleaned.trim();
        }

        // 2. Extract substring between first '{' and last '}'
        int firstBrace = cleaned.indexOf('{');
        int lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace != -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
        }

        try {
            AIAnalysisResponse result = mapper.readValue(cleaned, AIAnalysisResponse.class);
            if (result.getTags() == null) {
                result.setTags(List.of());
            }
            return result;
        } catch (Exception e) {
            logger.error("Failed to parse AI JSON response: {}", rawResponse, e);
            throw new RuntimeException("Unable to parse AI response: " + e.getMessage(), e);
        }
    }

    @Override
    public AIAnalysisResponse analyzeDocument(String content) {
        if (content == null) {
            content = "";
        }

        // Truncate content to avoid blowing context window
        String truncatedContent = content.length() > MAX_INPUT_LENGTH
                ? content.substring(0, MAX_INPUT_LENGTH) + "\n...[Content truncated for analysis]"
                : content;

        String prompt = """
You are an AI Knowledge Organizer.

Analyze the following content.

Return ONLY valid JSON with this exact structure:
{
  "title": "A concise, descriptive title",
  "summary": "A concise summary in 3-5 sentences",
  "category": "A single suitable category name",
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
1. Create a meaningful title.
2. Write a concise summary (3-5 sentences).
3. Generate the best single category (e.g. Technology, Programming, Research, Business).
4. Generate 3-5 short tags.
5. Return ONLY JSON without any surrounding conversational text or markdown blocks.

Document:
%s
""".formatted(truncatedContent);

        try {
            String response = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();

            logger.debug("Raw Ollama response: {}", response);
            return convertJsonToObject(response);
        } catch (Exception e) {
            logger.warn("Ollama AI call failed or timed out: {}", e.getMessage());
            throw new RuntimeException("AI analysis failed: " + e.getMessage(), e);
        }
    }
}