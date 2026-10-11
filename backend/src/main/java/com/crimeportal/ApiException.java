package com.crimeportal;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Error carrying an HTTP status; rendered as {"error": "..."} for the frontend. */
public class ApiException extends RuntimeException {
    public final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    @RestControllerAdvice
    public static class Handler {
        @ExceptionHandler(ApiException.class)
        public ResponseEntity<Map<String, String>> api(ApiException e) {
            return ResponseEntity.status(e.status).body(Map.of("error", e.getMessage()));
        }

        @ExceptionHandler(HttpMessageNotReadableException.class)
        public ResponseEntity<Map<String, String>> badJson(HttpMessageNotReadableException e) {
            return ResponseEntity.status(400).body(Map.of("error", "Invalid request body"));
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<Map<String, String>> other(Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Server error"));
        }
    }
}
