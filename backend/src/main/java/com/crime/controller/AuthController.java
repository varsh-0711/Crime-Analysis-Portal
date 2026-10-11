package com.crime.controller;
import com.crime.model.User;
import com.crime.repo.UserRepository;
import com.crime.security.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequestMapping("/api/auth")
public class AuthController {
  private final UserRepository users; private final PasswordEncoder enc; private final JwtUtil jwt;
  public AuthController(UserRepository u, PasswordEncoder e, JwtUtil j) { users = u; enc = e; jwt = j; }

  @PostMapping("/register")
  public ResponseEntity<?> register(@RequestBody Map<String, String> b) {
    if (users.findByUsername(b.get("username")).isPresent()) return ResponseEntity.badRequest().body("Username taken");
    users.save(new User(b.get("username"), enc.encode(b.get("password")), "PUBLIC")); // admin promotes police
    return ResponseEntity.ok("Registered");
  }
  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody Map<String, String> b) {
    var u = users.findByUsername(b.get("username"));
    if (u.isEmpty() || !enc.matches(b.get("password"), u.get().password)) return ResponseEntity.status(401).body("Invalid credentials");
    return ResponseEntity.ok(Map.of("token", jwt.create(u.get().username, u.get().role), "role", u.get().role));
  }
  @PutMapping("/users/{name}/role/{role}") // ADMIN only (enforced in SecurityConfig)
  public ResponseEntity<?> setRole(@PathVariable String name, @PathVariable String role) {
    var u = users.findByUsername(name).orElseThrow(); u.role = role.toUpperCase(); users.save(u);
    return ResponseEntity.ok("Updated");
  }
}
