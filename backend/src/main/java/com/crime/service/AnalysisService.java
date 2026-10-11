package com.crime.service;
import com.crime.model.CrimeRecord;
import com.crime.repo.CrimeRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalysisService {
  private final CrimeRepository repo;
  public AnalysisService(CrimeRepository r) { repo = r; }

  /** Grid hotspot detection (~1km cells). Recent crimes weigh double, so the score doubles as a risk prediction. */
  public List<Map<String, Object>> hotspots() {
    LocalDate cutoff = LocalDate.now().minusDays(90);
    Map<String, double[]> cells = new HashMap<>(); // [latSum, lngSum, count, score]
    for (CrimeRecord c : repo.findAll()) {
      String k = Math.round(c.latitude * 100) + ":" + Math.round(c.longitude * 100);
      double w = c.severity * (c.occurredAt != null && c.occurredAt.isAfter(cutoff) ? 2 : 1);
      double[] v = cells.computeIfAbsent(k, x -> new double[4]);
      v[0] += c.latitude; v[1] += c.longitude; v[2]++; v[3] += w;
    }
    double max = cells.values().stream().mapToDouble(v -> v[3]).max().orElse(1);
    return cells.values().stream().map(v -> {
      double r = v[3] / max;
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("lat", v[0] / v[2]); m.put("lng", v[1] / v[2]); m.put("count", (int) v[2]);
      m.put("risk", Math.round(r * 100) / 100.0); m.put("level", r > .66 ? "HIGH" : r > .33 ? "MEDIUM" : "LOW");
      return m;
    }).sorted((a, b) -> Double.compare((double) b.get("risk"), (double) a.get("risk"))).collect(Collectors.toList());
  }

  /** Monthly counts + next-month forecast via least-squares linear regression. */
  public Map<String, Object> trends() {
    List<CrimeRecord> all = repo.findAll();
    TreeMap<YearMonth, Long> m = all.stream().filter(c -> c.occurredAt != null)
      .collect(Collectors.groupingBy(c -> YearMonth.from(c.occurredAt), TreeMap::new, Collectors.counting()));
    List<String> labels = new ArrayList<>(); List<Long> values = new ArrayList<>();
    m.forEach((k, v) -> { labels.add(k.toString()); values.add(v); });
    int n = values.size(); double forecast = n > 0 ? values.get(n - 1) : 0;
    if (n >= 2) {
      double sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (int i = 0; i < n; i++) { sx += i; sy += values.get(i); sxy += i * values.get(i); sxx += i * i; }
      double slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
      forecast = Math.max(0, slope * n + icpt);
    }
    Map<String, Long> byType = all.stream().collect(Collectors.groupingBy(c -> c.type, Collectors.counting()));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("labels", labels); out.put("values", values);
    out.put("nextMonth", n > 0 ? YearMonth.parse(labels.get(n - 1)).plusMonths(1).toString() : "next");
    out.put("forecast", Math.round(forecast)); out.put("byType", byType);
    return out;
  }
}
