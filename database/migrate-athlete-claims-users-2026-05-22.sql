USE sport_hacker;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_col_if_missing $$
CREATE PROCEDURE add_col_if_missing(
  IN p_table VARCHAR(64),
  IN p_col VARCHAR(64),
  IN p_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col
  ) THEN
    SET @ddl = p_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_col_if_missing('sup_users', 'user_level', "ALTER TABLE sup_users ADD COLUMN user_level ENUM('free','vip','svip','admin','verified_athlete','trusted','blocked') NOT NULL DEFAULT 'free' AFTER password_hash");
CALL add_col_if_missing('sup_users', 'status', "ALTER TABLE sup_users ADD COLUMN status ENUM('active','blocked') NOT NULL DEFAULT 'active' AFTER user_level");
CALL add_col_if_missing('sup_users', 'daily_result_query_limit', "ALTER TABLE sup_users ADD COLUMN daily_result_query_limit INT NULL AFTER status");
CALL add_col_if_missing('sup_users', 'admin_note', "ALTER TABLE sup_users ADD COLUMN admin_note TEXT NULL AFTER daily_result_query_limit");
CALL add_col_if_missing('sup_users', 'last_login_at', "ALTER TABLE sup_users ADD COLUMN last_login_at DATETIME NULL AFTER admin_note");

ALTER TABLE sup_users
  MODIFY COLUMN user_level ENUM('free','vip','svip','admin','verified_athlete','trusted','blocked') NOT NULL DEFAULT 'free';

UPDATE sup_users
SET user_level = CASE
  WHEN nickname = 'i_add_u' OR email = 'xiehl9527@gmail.com' OR openid = 'sh_1' THEN 'admin'
  WHEN user_level = 'verified_athlete' THEN 'vip'
  WHEN user_level = 'trusted' THEN 'svip'
  ELSE user_level
END,
daily_result_query_limit = CASE
  WHEN nickname = 'i_add_u' OR email = 'xiehl9527@gmail.com' OR openid = 'sh_1' THEN NULL
  ELSE daily_result_query_limit
END;

ALTER TABLE sup_users
  MODIFY COLUMN user_level ENUM('free','vip','svip','admin','blocked') NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS sup_user_result_query_usage (
  user_id INT NOT NULL,
  usage_date DATE NOT NULL,
  query_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, usage_date),
  INDEX idx_result_usage_date (usage_date),
  CONSTRAINT fk_result_usage_user FOREIGN KEY (user_id) REFERENCES sup_users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_athlete_profile_claims (
  claim_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  athlete_id BIGINT NOT NULL,
  result_id BIGINT NULL,
  submitted_name VARCHAR(100) NULL,
  submitted_avatar_url VARCHAR(500) NULL,
  submitted_birth_year INT NULL,
  submitted_hometown_province VARCHAR(50) NULL,
  submitted_hometown_city VARCHAR(50) NULL,
  submitted_living_province VARCHAR(50) NULL,
  submitted_living_city VARCHAR(50) NULL,
  submitted_started_sup_year INT NULL,
  submitted_intro_short VARCHAR(160) NULL,
  submitted_intro TEXT NULL,
  submitted_profile_json JSON NULL,
  bib_prefix VARCHAR(20) NULL,
  submitted_bib_number VARCHAR(50) NULL,
  bib_match_status ENUM('unchecked','matched','mismatched') NOT NULL DEFAULT 'unchecked',
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer_note TEXT NULL,
  reviewed_at DATETIME NULL,
  reviewed_by VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_claims_status_created (status, created_at),
  INDEX idx_claims_user (user_id, created_at),
  INDEX idx_claims_athlete (athlete_id, created_at),
  CONSTRAINT fk_claims_user FOREIGN KEY (user_id) REFERENCES sup_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_claims_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE CASCADE,
  CONSTRAINT fk_claims_result FOREIGN KEY (result_id) REFERENCES sup_event_results(result_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_athlete_profile_owners (
  athlete_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('contributor','owner') NOT NULL DEFAULT 'contributor',
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (athlete_id, user_id),
  INDEX idx_profile_owners_user (user_id, status),
  CONSTRAINT fk_profile_owners_athlete FOREIGN KEY (athlete_id) REFERENCES sup_athletes(athlete_id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_owners_user FOREIGN KEY (user_id) REFERENCES sup_users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS add_col_if_missing;
