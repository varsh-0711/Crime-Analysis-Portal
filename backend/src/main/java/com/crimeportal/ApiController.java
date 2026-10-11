package com.crimeportal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/** All endpoints live under /api. Everything except login/register needs "Authorization: Bearer <token>". */
@RestController
@RequestMapping("/api")
public class ApiController {
    private static final List<String> STATUSES = List.of("Submitted", "Under Review", "Verified", "Resolved", "Rejected");
    private static final Pattern NAME = Pattern.compile("^[A-Za-z][A-Za-z .'-]{1,39}$");
    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Map<String, Object> OK = Map.of("ok", true);

    private static final class Sess {
        final String username;
        boolean police;
        Sess(String u) { username = u; }
    }

    private record Auth(String token, String username, String role, boolean police) {
        boolean admin() { return role.equals("ADMIN"); }
    }

    private final Store st;
    private final Map<String, Sess> sessions = new ConcurrentHashMap<>();
    private final SecureRandom rng = new SecureRandom();

    @Value("${app.police-code:POL-2026}")
    private String policeCode;

    public ApiController(Store st) { this.st = st; }

    /* ---------- helpers ---------- */
    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }

    private static ApiException err(int code, String msg) { return new ApiException(code, msg); }

    private Auth authed(String header) {
        String t = header == null ? "" : header.replace("Bearer ", "").trim();
        Sess s = sessions.get(t);
        if (s == null) throw err(401, "Please login again");
        Map<String, Object> u = st.findUser(s.username, false);
        if (u == null) { sessions.remove(t); throw err(401, "Account no longer exists"); }
        String role = str(u.get("role"));
        return new Auth(t, s.username, role, s.police || !role.equals("PUBLIC"));
    }

    private static void needPolice(Auth a) { if (!a.police()) throw err(403, "Police access required"); }

    private static void needAdmin(Auth a) { if (!a.admin()) throw err(403, "Administrator access required"); }

    private static double num(Object v, double lo, double hi, String name) {
        try {
            double d = Double.parseDouble(str(v));
            if (Double.isFinite(d) && d >= lo && d <= hi) return d;
        } catch (NumberFormatException ignored) { }
        throw err(400, "Invalid " + name);
    }

    private static double dbl(Object v, double def) {
        try {
            double d = Double.parseDouble(str(v));
            return Double.isFinite(d) ? d : def;
        } catch (NumberFormatException e) { return def; }
    }

    private Map<String, Object> login(String name, String pw, String msg) {
        Map<String, Object> u = st.findUser(name, true);
        if (u == null || !Store.checkPassword(pw, u)) throw err(401, "Invalid name or password");
        byte[] b = new byte[24];
        rng.nextBytes(b);
        String token = HexFormat.of().formatHex(b);
        sessions.put(token, new Sess(str(u.get("username"))));
        st.audit(str(u.get("username")), msg);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("token", token);
        r.put("username", u.get("username"));
        r.put("role", u.get("role"));
        return r;
    }

    /* ---------- auth ---------- */
    @PostMapping("/auth/register")
    public synchronized Map<String, Object> register(@RequestBody Map<String, Object> b) {
        String name = str(b.get("username")).trim().replaceAll("\\s+", " "), pw = str(b.get("password"));
        if (!NAME.matcher(name).matches()) throw err(400, "Name should contain only letters and spaces (2-40 characters)");
        if (pw.length() < 6) throw err(400, "Password must be at least 6 characters");
        if (st.findUser(name, true) != null)
            throw err(409, "This name is already registered. Please login or use a different name");
        st.list("users").add(Store.newUser(name, pw, "PUBLIC"));
        st.save();
        return login(name, pw, "Registered and signed in");
    }

    @PostMapping("/auth/login")
    public synchronized Map<String, Object> login(@RequestBody Map<String, Object> b) {
        return login(str(b.get("username")).trim(), str(b.get("password")), "Signed in");
    }

    @PostMapping("/auth/logout")
    public synchronized Map<String, Object> logout(@RequestHeader(value = "Authorization", required = false) String h) {
        sessions.remove(authed(h).token());
        return OK;
    }

    @PostMapping("/auth/police-code")
    public synchronized Map<String, Object> policeCode(@RequestHeader(value = "Authorization", required = false) String h,
                                                       @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        if (!str(b.get("code")).trim().equalsIgnoreCase(policeCode)) throw err(403, "Incorrect access code");
        sessions.get(a.token()).police = true;
        st.audit(a.username(), "Verified police access code");
        return OK;
    }

    @PostMapping("/audit")
    public synchronized Map<String, Object> audit(@RequestHeader(value = "Authorization", required = false) String h,
                                                  @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        String m = str(b.get("m"));
        st.audit(a.username(), m.length() > 200 ? m.substring(0, 200) : m);
        return OK;
    }

    /* ---------- state (filtered by role) ---------- */
    @GetMapping("/state")
    public synchronized Map<String, Object> state(@RequestHeader(value = "Authorization", required = false) String h) {
        Auth a = authed(h);
        List<Map<String, Object>> users = new ArrayList<>();
        for (Map<String, Object> u : st.list("users")) {
            if (a.admin() || str(u.get("username")).equals(a.username())) {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("username", u.get("username"));
                v.put("role", u.get("role"));
                users.add(v);
            }
        }
        List<Map<String, Object>> complaints = new ArrayList<>();
        for (Map<String, Object> c : st.list("complaints")) {
            boolean mine = str(c.get("by")).equals(a.username());
            if (!a.police() && !mine) continue;
            if (!a.admin() && !mine && Boolean.TRUE.equals(c.get("anon"))) {
                c = new LinkedHashMap<>(c);
                c.put("by", "Anonymous");
            }
            complaints.add(c);
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("crimes", st.list("crimes"));
        r.put("patrols", st.map("patrols"));
        r.put("users", users);
        r.put("complaints", complaints);
        r.put("sos", a.police() ? st.list("sos") : List.of());
        r.put("audit", a.admin() ? st.list("audit") : List.of());
        return r;
    }

    /* ---------- complaints ---------- */
    @PostMapping("/complaints")
    public synchronized Map<String, Object> addComplaint(@RequestHeader(value = "Authorization", required = false) String h,
                                                         @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        String area = str(b.get("area")).trim(), desc = str(b.get("description")).trim();
        if (area.isEmpty()) throw err(400, "Please enter the area");
        if (desc.length() < 10) throw err(400, "Please describe the incident (at least 10 characters)");
        if (!Store.TYPES.contains(str(b.get("type")))) throw err(400, "Invalid crime type");
        if (!List.of("Low", "Medium", "High").contains(str(b.get("urgency")))) throw err(400, "Invalid urgency");
        String id = "CMP-" + st.nextComplaint();
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("id", id);
        c.put("by", a.username());
        c.put("type", b.get("type"));
        c.put("area", area);
        c.put("description", desc);
        c.put("date", DATE.matcher(str(b.get("date"))).matches() ? b.get("date") : Store.today());
        c.put("urgency", b.get("urgency"));
        c.put("anon", Boolean.TRUE.equals(b.get("anon")));
        c.put("lat", dbl(b.get("lat"), 17.385));
        c.put("lng", dbl(b.get("lng"), 78.486));
        c.put("status", "Submitted");
        c.put("note", "");
        st.list("complaints").add(c);
        st.audit(a.username(), "Filed complaint " + id);
        return Map.of("id", id);
    }

    @PatchMapping("/complaints/{id}")
    public synchronized Map<String, Object> updateComplaint(@RequestHeader(value = "Authorization", required = false) String h,
                                                            @PathVariable String id, @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        needPolice(a);
        Map<String, Object> c = st.list("complaints").stream().filter(x -> str(x.get("id")).equals(id)).findFirst()
                .orElseThrow(() -> err(404, "Complaint not found"));
        if (b.containsKey("note")) {
            String n = str(b.get("note"));
            c.put("note", n.length() > 500 ? n.substring(0, 500) : n);
        }
        if (b.containsKey("status")) {
            String s = str(b.get("status"));
            if (!STATUSES.contains(s)) throw err(400, "Invalid status");
            c.put("status", s);
            if (s.equals("Verified") && c.get("crimeId") == null) {   // verified complaints feed the hotspot data
                int cid = st.nextId();
                c.put("crimeId", cid);
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", cid);
                m.put("type", c.get("type"));
                m.put("description", c.get("description"));
                m.put("area", c.get("area"));
                m.put("latitude", c.get("lat"));
                m.put("longitude", c.get("lng"));
                m.put("severity", switch (str(c.get("urgency"))) { case "Low" -> 1; case "Medium" -> 3; default -> 5; });
                m.put("occurredAt", c.get("date"));
                m.put("hour", java.time.LocalTime.now().getHour());
                st.list("crimes").add(m);
            }
            st.audit(a.username(), id + " marked " + s);
        } else {
            st.save();
        }
        return OK;
    }

    @DeleteMapping("/complaints/{id}")
    public synchronized Map<String, Object> deleteComplaint(@RequestHeader(value = "Authorization", required = false) String h,
                                                            @PathVariable String id) {
        Auth a = authed(h);
        needAdmin(a);
        st.list("complaints").removeIf(c -> str(c.get("id")).equals(id));
        st.audit(a.username(), "Deleted complaint " + id);
        return OK;
    }

    /* ---------- crime records ---------- */
    @PostMapping("/crimes")
    public synchronized Map<String, Object> addCrime(@RequestHeader(value = "Authorization", required = false) String h,
                                                     @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        needPolice(a);
        String area = str(b.get("area")).trim();
        if (area.isEmpty()) throw err(400, "Enter the area");
        if (!Store.TYPES.contains(str(b.get("type")))) throw err(400, "Invalid crime type");
        String desc = str(b.get("description")).trim();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", st.nextId());
        m.put("type", b.get("type"));
        m.put("description", desc.isEmpty() ? "Reported incident" : desc);
        m.put("area", area);
        m.put("latitude", num(b.get("latitude"), -90, 90, "latitude"));
        m.put("longitude", num(b.get("longitude"), -180, 180, "longitude"));
        m.put("severity", (int) Math.round(num(b.get("severity"), 1, 5, "severity")));
        m.put("occurredAt", Store.today());
        m.put("hour", (int) Math.round(num(b.get("hour"), 0, 23, "hour")));
        st.list("crimes").add(m);
        st.audit(a.username(), "Added incident in " + area);
        return OK;
    }

    @PostMapping("/crimes/upload")
    public synchronized Map<String, Object> upload(@RequestHeader(value = "Authorization", required = false) String h,
                                                   @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        needPolice(a);
        int ok = 0, skipped = 0;
        Set<String> seen = new HashSet<>();
        String[] lines = str(b.get("csv")).split("\\R");
        for (int i = 1; i < lines.length; i++) {
            String l = lines[i];
            if (l.isBlank()) continue;
            String[] p = l.split(",", -1);
            if (p.length < 7 || !seen.add(l.trim())) { skipped++; continue; }
            try {
                double lat = Double.parseDouble(p[2].trim()), lng = Double.parseDouble(p[3].trim());
                int sv = (int) Double.parseDouble(p[5].trim());
                String d = p[6].trim();
                if (!DATE.matcher(d).matches()) throw new NumberFormatException();
                LocalDate.parse(d);
                int hr = 12;
                if (p.length > 7) {
                    try { hr = ((int) Double.parseDouble(p[7].trim())) % 24; } catch (NumberFormatException ignored) { }
                }
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", st.nextId());
                m.put("type", p[0].trim());
                m.put("description", p[1].trim());
                m.put("area", p[4].trim());
                m.put("latitude", lat);
                m.put("longitude", lng);
                m.put("severity", sv);
                m.put("occurredAt", d);
                m.put("hour", hr);
                st.list("crimes").add(m);
                ok++;
            } catch (RuntimeException e) {
                skipped++;
            }
        }
        st.audit(a.username(), "Uploaded crime data: " + ok + " added, " + skipped + " skipped");
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("imported", ok);
        r.put("skipped", skipped);
        return r;
    }

    @DeleteMapping("/crimes/{id}")
    public synchronized Map<String, Object> deleteCrime(@RequestHeader(value = "Authorization", required = false) String h,
                                                        @PathVariable String id) {
        Auth a = authed(h);
        needAdmin(a);
        st.list("crimes").removeIf(c -> str(c.get("id")).equals(id));
        st.audit(a.username(), "Deleted incident " + id);
        return OK;
    }

    /* ---------- SOS ---------- */
    @PostMapping("/sos")
    public synchronized Map<String, Object> sos(@RequestHeader(value = "Authorization", required = false) String h,
                                                @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", System.currentTimeMillis());
        m.put("by", a.username());
        m.put("t", java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("M/d/yyyy, h:mm:ss a", Locale.ENGLISH)));
        m.put("lat", b.get("lat") == null ? null : dbl(b.get("lat"), 0));
        m.put("lng", b.get("lng") == null ? null : dbl(b.get("lng"), 0));
        m.put("status", "Open");
        st.list("sos").add(m);
        st.audit(a.username(), "Sent SOS alert");
        return OK;
    }

    @PatchMapping("/sos/{id}")
    public synchronized Map<String, Object> ackSos(@RequestHeader(value = "Authorization", required = false) String h,
                                                   @PathVariable String id) {
        Auth a = authed(h);
        needPolice(a);
        Map<String, Object> x = st.list("sos").stream()
                .filter(v -> String.valueOf(((Number) v.get("id")).longValue()).equals(id)).findFirst()
                .orElseThrow(() -> err(404, "Alert not found"));
        x.put("status", "Acknowledged");
        st.audit(a.username(), "Acknowledged SOS from " + x.get("by"));
        return OK;
    }

    /* ---------- patrols ---------- */
    @PutMapping("/patrols")
    public synchronized Map<String, Object> patrol(@RequestHeader(value = "Authorization", required = false) String h,
                                                   @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        needPolice(a);
        boolean on = Boolean.TRUE.equals(b.get("assigned"));
        st.map("patrols").put(str(b.get("area")), on);
        st.audit(a.username(), (on ? "Assigned" : "Removed") + " patrol: " + str(b.get("area")));
        return OK;
    }

    /* ---------- users & system (admin) ---------- */
    @PatchMapping("/users/{name}")
    public synchronized Map<String, Object> setRole(@RequestHeader(value = "Authorization", required = false) String h,
                                                    @PathVariable String name, @RequestBody Map<String, Object> b) {
        Auth a = authed(h);
        needAdmin(a);
        Map<String, Object> u = st.findUser(name, false);
        if (u == null) throw err(404, "User not found");
        if (name.equals("admin")) throw err(400, "The admin account cannot be changed");
        String role = str(b.get("role"));
        if (!List.of("PUBLIC", "POLICE", "ADMIN").contains(role)) throw err(400, "Invalid role");
        u.put("role", role);
        st.audit(a.username(), "Set " + name + " to " + role);
        return OK;
    }

    @DeleteMapping("/users/{name}")
    public synchronized Map<String, Object> deleteUser(@RequestHeader(value = "Authorization", required = false) String h,
                                                       @PathVariable String name) {
        Auth a = authed(h);
        needAdmin(a);
        if (name.equals("admin")) throw err(400, "The admin account cannot be removed");
        st.list("users").removeIf(u -> str(u.get("username")).equals(name));
        sessions.values().removeIf(s -> s.username.equals(name));
        st.audit(a.username(), "Removed user " + name);
        return OK;
    }

    @PostMapping("/reset")
    public synchronized Map<String, Object> reset(@RequestHeader(value = "Authorization", required = false) String h) {
        Auth a = authed(h);
        needAdmin(a);
        st.reset();
        sessions.values().removeIf(s -> !s.username.equals("admin"));
        st.audit(a.username(), "Reset demo data");
        return OK;
    }
}
