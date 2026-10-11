package com.crime.controller;
import com.crime.model.CrimeRecord;
import com.crime.repo.CrimeRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.time.LocalDate;
import java.util.*;
@RestController @RequestMapping("/api/crimes")
public class CrimeController {
  private final CrimeRepository repo;
  public CrimeController(CrimeRepository r) { repo = r; }

  @GetMapping public List<CrimeRecord> all() { return repo.findAll(); }
  @PostMapping public CrimeRecord report(@RequestBody CrimeRecord c) { c.id = null; if (c.occurredAt == null) c.occurredAt = LocalDate.now(); return repo.save(c); }
  @DeleteMapping("/{id}") public void delete(@PathVariable Long id) { repo.deleteById(id); }

  /** CSV columns: type,description,latitude,longitude,area,severity,date(yyyy-MM-dd). Skips bad rows and duplicates. */
  @PostMapping("/upload")
  public Map<String, Integer> upload(@RequestParam("file") MultipartFile f) throws IOException {
    Set<String> seen = new HashSet<>(); int ok = 0, skipped = 0;
    try (var br = new BufferedReader(new InputStreamReader(f.getInputStream()))) {
      br.readLine(); String line;
      while ((line = br.readLine()) != null) {
        String[] p = line.split(",");
        try {
          if (p.length < 7 || !seen.add(line.trim())) { skipped++; continue; }
          var c = new CrimeRecord();
          c.type = p[0].trim(); c.description = p[1].trim(); c.latitude = Double.parseDouble(p[2]); c.longitude = Double.parseDouble(p[3]);
          c.area = p[4].trim(); c.severity = Integer.parseInt(p[5].trim()); c.occurredAt = LocalDate.parse(p[6].trim());
          repo.save(c); ok++;
        } catch (Exception e) { skipped++; }
      }
    }
    return Map.of("imported", ok, "skipped", skipped);
  }
}
