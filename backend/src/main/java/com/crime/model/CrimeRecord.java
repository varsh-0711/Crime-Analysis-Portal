package com.crime.model;
import jakarta.persistence.*;
import java.time.LocalDate;
@Entity
public class CrimeRecord {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
  public String type, description, area;
  public double latitude, longitude;
  public int severity = 1; // 1-5
  public LocalDate occurredAt;
}
