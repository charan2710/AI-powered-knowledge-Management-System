package com.charan.knowledge_os.controller;

import com.charan.knowledge_os.dto.DashboardResponse;
import com.charan.knowledge_os.service.DashboardService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(
            DashboardService dashboardService) {

        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardResponse dashboard() {

        return dashboardService.getDashboard();

    }

}