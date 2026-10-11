package com.crime;
import com.crime.model.CrimeRecord;
import com.crime.model.User;
import com.crime.repo.CrimeRepository;
import com.crime.repo.UserRepository;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.time.LocalDate;
import java.util.Random;

@SpringBootApplication
public class CrimeApplication {
  public static void main(String[] a) { SpringApplication.run(CrimeApplication.class, a); }

  /** Seeds the admin user and ~80 demo crimes (only when tables are empty). */
  @Bean CommandLineRunner seed(UserRepository users, CrimeRepository crimes, PasswordEncoder enc) {
    return x -> {
      if (users.findByUsername("admin").isEmpty()) users.save(new User("admin", enc.encode("admin123"), "ADMIN"));
      if (crimes.count() == 0) {
        Random r = new Random(7);
        double[][] c = {{17.385, 78.486}, {17.440, 78.349}, {17.450, 78.380}, {17.420, 78.450}};
        String[] areas = {"Charminar", "Gachibowli", "Madhapur", "Banjara Hills"};
        String[] types = {"Theft", "Robbery", "Assault", "Burglary"};
        for (int i = 0; i < 80; i++) {
          int k = r.nextInt(10) < 4 ? 0 : r.nextInt(4);
          CrimeRecord cr = new CrimeRecord();
          cr.type = types[r.nextInt(4)]; cr.description = "Demo incident"; cr.area = areas[k];
          cr.latitude = c[k][0] + (r.nextDouble() - .5) * .006; cr.longitude = c[k][1] + (r.nextDouble() - .5) * .006;
          cr.severity = 1 + r.nextInt(5); cr.occurredAt = LocalDate.now().minusDays(r.nextInt(180));
          crimes.save(cr);
        }
      }
    };
  }
}
