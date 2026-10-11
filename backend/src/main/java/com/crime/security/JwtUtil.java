package com.crime.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

  private final SecretKey key;

  public JwtUtil(@Value("${jwt.secret}") String secret) {
    this.key = Keys.hmacShaKeyFor(
            secret.getBytes(StandardCharsets.UTF_8)
    );
  }

  public String create(String user, String role) {
    return Jwts.builder()
            .setSubject(user)
            .claim("role", role)
            .setExpiration(
                    new Date(System.currentTimeMillis() + 86400000)
            )
            .signWith(key, SignatureAlgorithm.HS256)
            .compact();
  }

  public Claims parse(String token) {
    return Jwts.parserBuilder()
            .setSigningKey(key)
            .build()
            .parseClaimsJws(token)
            .getBody();
  }
}
