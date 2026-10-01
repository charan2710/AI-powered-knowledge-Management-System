package com.charan.knowledge_os.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebPageRequest {

    private String url;

    private String title;

    private String website;

    private String content;

}