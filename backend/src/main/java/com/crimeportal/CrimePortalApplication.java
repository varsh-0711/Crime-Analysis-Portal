package com.crimeportal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;

@SpringBootApplication(
        scanBasePackages = "com.crimeportal",
        exclude = {
                SecurityAutoConfiguration.class,
                UserDetailsServiceAutoConfiguration.class,
                DataSourceAutoConfiguration.class,
                HibernateJpaAutoConfiguration.class
        }
)
public class CrimePortalApplication {
    public static void main(String[] args) {
        SpringApplication.run(CrimePortalApplication.class, args);
    }
}
