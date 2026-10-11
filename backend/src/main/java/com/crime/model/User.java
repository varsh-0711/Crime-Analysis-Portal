package com.crime.model;
import jakarta.persistence.*;
@Entity @Table(name = "users")
public class User {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
  @Column(unique = true) public String username;
  public String password;
  public String role; // PUBLIC, POLICE, ADMIN
  public User() {}
  public User(String u, String p, String r) { username = u; password = p; role = r; }
}
