package com.crime;
import com.crime.model.CrimeRecord;
import com.crime.repo.CrimeRepository;
import com.crime.service.AnalysisService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class AnalysisServiceTest {
  private CrimeRecord rec(double lat, double lng, int sev, LocalDate d) {
    var c = new CrimeRecord(); c.type = "Theft"; c.latitude = lat; c.longitude = lng; c.severity = sev; c.occurredAt = d; return c;
  }
  private AnalysisService svc(List<CrimeRecord> data) {
    var repo = Mockito.mock(CrimeRepository.class); Mockito.when(repo.findAll()).thenReturn(data); return new AnalysisService(repo);
  }
  @Test void busiestCellIsHighRiskAndFirst() {
    var now = LocalDate.now();
    var h = svc(List.of(rec(17.385, 78.486, 5, now), rec(17.385, 78.486, 4, now), rec(17.50, 78.60, 1, now))).hotspots();
    assertEquals("HIGH", h.get(0).get("level")); assertEquals(2, h.get(0).get("count")); assertEquals("LOW", h.get(1).get("level"));
  }
  @Test void linearTrendForecastsNextMonth() {
    List<CrimeRecord> d = new ArrayList<>();
    for (int m = 1; m <= 3; m++) for (int i = 0; i < m; i++) d.add(rec(17, 78, 1, LocalDate.of(2026, m, 10)));
    var t = svc(d).trends();
    assertEquals(4L, t.get("forecast")); assertEquals("2026-04", t.get("nextMonth"));
  }
}
