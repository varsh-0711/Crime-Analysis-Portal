package com.crime.repo;
import com.crime.model.CrimeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CrimeRepository extends JpaRepository<CrimeRecord, Long> {}
