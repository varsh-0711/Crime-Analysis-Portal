package com.crimeportal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/** Holds all portal data in memory and persists it to a JSON file (default ./data/db.json). */
@Component
public class Store {
    public static final List<String> TYPES =
            List.of("Theft", "Robbery", "Assault", "Burglary", "Harassment", "Cyber Fraud");
    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("M/d/yyyy, h:mm:ss a", Locale.ENGLISH);

    private final ObjectMapper om = new ObjectMapper();
    private final Path file;
    private Map<String, Object> db;

    public Store(@Value("${app.data-file:./data/db.json}") String path) {
        this.file = Path.of(path);
        load();
    }

    /* ---------- access helpers ---------- */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> list(String key) {
        return (List<Map<String, Object>>) db.get(key);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> map(String key) {
        return (Map<String, Object>) db.get(key);
    }

    public void setList(String key, List<Map<String, Object>> v) {
        db.put(key, v);
    }

    public int nextId() { return bump("nextId"); }

    public int nextComplaint() { return bump("nextC"); }

    private int bump(String key) {
        int v = ((Number) db.get(key)).intValue();
        db.put(key, v + 1);
        return v;
    }

    public Map<String, Object> findUser(String name, boolean ignoreCase) {
        for (Map<String, Object> u : list("users")) {
            String n = String.valueOf(u.get("username"));
            if (ignoreCase ? n.equalsIgnoreCase(name) : n.equals(name)) return u;
        }
        return null;
    }

    public static String today() { return LocalDate.now().toString(); }

    public void audit(String user, String msg) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("t", LocalDateTime.now().format(STAMP));
        a.put("u", user == null ? "-" : user);
        a.put("m", msg);
        List<Map<String, Object>> log = list("audit");
        log.add(0, a);
        while (log.size() > 40) log.remove(log.size() - 1);
        save();
    }

    /* ---------- persistence ---------- */
    private void load() {
        try {
            if (Files.exists(file)) {
                db = om.readValue(file.toFile(), new TypeReference<LinkedHashMap<String, Object>>() {});
            }
        } catch (Exception e) {
            db = null;
        }
        if (db == null) db = seed();
        ensureAdmin();
        save();
    }

    public void save() {
        try {
            Path abs = file.toAbsolutePath();
            Files.createDirectories(abs.getParent());
            Path tmp = abs.resolveSibling(abs.getFileName() + ".tmp");
            om.writeValue(tmp.toFile(), db);
            Files.move(tmp, abs, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void reset() {
        db = seed();
        ensureAdmin();
        save();
    }

    private void ensureAdmin() {
        if (findUser("admin", true) == null) list("users").add(0, newUser("admin", "admin123", "ADMIN"));
    }

    /* ---------- passwords (PBKDF2) ---------- */
    public static Map<String, Object> newUser(String name, String pw, String role) {
        byte[] s = new byte[16];
        new SecureRandom().nextBytes(s);
        String salt = HexFormat.of().formatHex(s);
        Map<String, Object> u = new LinkedHashMap<>();
        u.put("username", name);
        u.put("salt", salt);
        u.put("hash", hash(pw, salt));
        u.put("role", role);
        return u;
    }

    public static boolean checkPassword(String pw, Map<String, Object> u) {
        byte[] a = hash(pw, String.valueOf(u.get("salt"))).getBytes();
        byte[] b = String.valueOf(u.get("hash")).getBytes();
        return MessageDigest.isEqual(a, b);
    }

    private static String hash(String pw, String salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(pw.toCharArray(), HexFormat.of().parseHex(salt), 65536, 256);
            return HexFormat.of().formatHex(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec).getEncoded());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /* ---------- demo data ---------- */
    private static final class Rnd {          // small seeded PRNG so demo data is repeatable
        int a;
        Rnd(int seed) { a = seed; }
        double next() {
            a += 0x6D2B79F5;
            int t = (a ^ (a >>> 15)) * (1 | a);
            t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
            return ((t ^ (t >>> 14)) & 0xFFFFFFFFL) / 4294967296.0;
        }
    }

    private Map<String, Object> seed() {
        Rnd r = new Rnd(7);
        double[][] c = {{17.385, 78.486}, {17.44, 78.349}, {17.45, 78.38}, {17.42, 78.45}, {17.495, 78.399}, {17.348, 78.552}};
        String[] ar = {"Charminar", "Gachibowli", "Madhapur", "Banjara Hills", "Kukatpally", "LB Nagar"};
        List<Map<String, Object>> crimes = new ArrayList<>();
        for (int i = 0; i < 120; i++) {
            int k = r.next() < .4 ? 0 : (int) Math.floor(r.next() * 6);
            int days = (int) Math.floor(r.next() * 180);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i + 1);
            m.put("type", TYPES.get((int) Math.floor(r.next() * 6)));
            m.put("description", "Reported incident");
            m.put("area", ar[k]);
            m.put("latitude", c[k][0] + (r.next() - .5) * .006);
            m.put("longitude", c[k][1] + (r.next() - .5) * .006);
            m.put("severity", 1 + (int) Math.floor(r.next() * 5));
            m.put("occurredAt", LocalDate.now().minusDays(days).toString());
            m.put("hour", r.next() < .6 ? (18 + (int) Math.floor(r.next() * 6)) % 24 : (int) Math.floor(r.next() * 24));
            crimes.add(m);
        }
        List<Map<String, Object>> complaints = new ArrayList<>();
        complaints.add(complaint("CMP-1001", "Anita Sharma", "Theft", "Madhapur", "Mobile phone snatched near the metro station.", "High", "Submitted"));
        complaints.add(complaint("CMP-1002", "Ravi Kumar", "Harassment", "Gachibowli", "Repeated harassment near the bus stop at night.", "Medium", "Under Review"));
        complaints.add(complaint("CMP-1003", "Sneha Rao", "Cyber Fraud", "Banjara Hills", "Lost money to a fake KYC call.", "High", "Submitted"));

        Map<String, Object> d = new LinkedHashMap<>();
        List<Map<String, Object>> users = new ArrayList<>();
        users.add(newUser("admin", "admin123", "ADMIN"));
        d.put("users", users);
        d.put("crimes", crimes);
        d.put("complaints", complaints);
        d.put("patrols", new LinkedHashMap<String, Object>());
        d.put("audit", new ArrayList<Map<String, Object>>());
        d.put("sos", new ArrayList<Map<String, Object>>());
        d.put("nextId", 121);
        d.put("nextC", 1004);
        return d;
    }

    private static Map<String, Object> complaint(String id, String by, String type, String area, String desc, String urgency, String status) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id", id);
        c.put("by", by);
        c.put("type", type);
        c.put("area", area);
        c.put("description", desc);
        c.put("date", today());
        c.put("urgency", urgency);
        c.put("anon", false);
        c.put("lat", 17.45);
        c.put("lng", 78.38);
        c.put("status", status);
        c.put("note", "");
        return c;
    }
}
