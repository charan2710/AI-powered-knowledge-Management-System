package com.charan.knowledge_os.controller;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @PostConstruct
    public void init() {
        System.out.println("===== PageController Loaded =====");
    }

    @GetMapping({"", "/", "/dashboard", "/ds"})
    public String dashboard() {
        return "dashboard";
    }
}