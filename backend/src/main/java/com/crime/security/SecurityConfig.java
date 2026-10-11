package com.crime.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
public class SecurityConfig {

  @Bean
  PasswordEncoder encoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity http, JwtFilter f)
          throws Exception {

    http
            .csrf(c -> c.disable())
            .cors(Customizer.withDefaults())
            .httpBasic(b -> b.disable())
            .formLogin(form -> form.disable())
            .sessionManagement(s ->
                    s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                    .requestMatchers(
                            "/",
                            "/error",
                            "/api/health",
                            "/api/auth/login",
                            "/api/auth/register"
                    ).permitAll()
                    .requestMatchers("/api/crimes/upload")
                    .hasAnyRole("POLICE", "ADMIN")
                    .requestMatchers(HttpMethod.DELETE, "/api/crimes/**")
                    .hasRole("ADMIN")
                    .requestMatchers("/api/auth/users/**")
                    .hasRole("ADMIN")
                    .anyRequest().authenticated()
            )
            .addFilterBefore(
                    f,
                    UsernamePasswordAuthenticationFilter.class
            );

    return http.build();
  }

  @Bean
  CorsConfigurationSource cors(
          @Value("${cors.origins}") String origins) {

    CorsConfiguration c = new CorsConfiguration();

    c.setAllowedOriginPatterns(
            Arrays.asList(origins.split(","))
    );

    c.setAllowedMethods(
            Arrays.asList(
                    "GET", "POST", "PUT", "DELETE", "OPTIONS"
            )
    );

    c.setAllowedHeaders(
            Arrays.asList("*")
    );

    UrlBasedCorsConfigurationSource source =
            new UrlBasedCorsConfigurationSource();

    source.registerCorsConfiguration("/**", c);

    return source;
  }
}
