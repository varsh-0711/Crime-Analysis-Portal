package com.crime.controller;
import com.crime.service.AnalysisService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/analytics")
public class AnalyticsController {
  private final AnalysisService svc;
  public AnalyticsController(AnalysisService s) { svc = s; }
  @GetMapping("/hotspots") public List<Map<String, Object>> hotspots() { return svc.hotspots(); }
  @GetMapping("/trends") public Map<String, Object> trends() { return svc.trends(); }
}
