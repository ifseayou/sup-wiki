-- 俱乐部认领模式：成绩册队伍名 -> 俱乐部别名映射 + 用户认领审核

SET @column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sup_event_results' AND COLUMN_NAME = 'team_name_normalized'
);
SET @ddl = IF(
  @column_exists = 0,
  'ALTER TABLE sup_event_results ADD COLUMN team_name_normalized VARCHAR(220) NULL AFTER team_name',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sup_event_results' AND INDEX_NAME = 'idx_event_results_team_normalized'
);
SET @ddl = IF(
  @index_exists = 0,
  'ALTER TABLE sup_event_results ADD INDEX idx_event_results_team_normalized (team_name_normalized)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sup_club_team_aliases (
  alias_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NULL,
  team_name_raw VARCHAR(200) NOT NULL,
  normalized_name VARCHAR(220) NOT NULL,
  match_status ENUM('unmatched','candidate','confirmed','ignored','rejected') NOT NULL DEFAULT 'unmatched',
  confidence DECIMAL(4,3) NOT NULL DEFAULT 0.600,
  result_count INT NOT NULL DEFAULT 0,
  event_count INT NOT NULL DEFAULT 0,
  athlete_count INT NOT NULL DEFAULT 0,
  first_seen_event_id BIGINT NULL,
  last_seen_event_id BIGINT NULL,
  source_type VARCHAR(80) NOT NULL DEFAULT 'event_result_team',
  admin_note VARCHAR(500) NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sup_club_team_aliases_normalized (normalized_name),
  INDEX idx_sup_club_team_aliases_club (club_id, match_status),
  INDEX idx_sup_club_team_aliases_status_count (match_status, result_count),
  INDEX idx_sup_club_team_aliases_raw (team_name_raw),
  CONSTRAINT fk_sup_club_team_aliases_club FOREIGN KEY (club_id) REFERENCES sup_clubs(club_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sup_club_claims (
  claim_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  club_id INT NULL,
  alias_id BIGINT NULL,
  submitted_club_name VARCHAR(200) NOT NULL,
  submitted_alias_names JSON NULL,
  submitted_role VARCHAR(100) NULL,
  contact_info VARCHAR(255) NOT NULL,
  claim_note TEXT NULL,
  proof_images JSON NULL,
  status ENUM('pending','reviewing','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note VARCHAR(1000) NULL,
  reviewed_at TIMESTAMP NULL,
  created_club_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_club_claims_user (user_id, created_at),
  INDEX idx_sup_club_claims_status (status, created_at),
  INDEX idx_sup_club_claims_club (club_id),
  INDEX idx_sup_club_claims_alias (alias_id),
  CONSTRAINT fk_sup_club_claims_club FOREIGN KEY (club_id) REFERENCES sup_clubs(club_id) ON DELETE SET NULL,
  CONSTRAINT fk_sup_club_claims_alias FOREIGN KEY (alias_id) REFERENCES sup_club_team_aliases(alias_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_club_owners (
  owner_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(80) NOT NULL DEFAULT 'owner',
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  verified_at TIMESTAMP NULL,
  source_claim_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sup_club_owners (club_id, user_id),
  INDEX idx_sup_club_owners_user (user_id, status),
  CONSTRAINT fk_sup_club_owners_club FOREIGN KEY (club_id) REFERENCES sup_clubs(club_id) ON DELETE CASCADE,
  CONSTRAINT fk_sup_club_owners_claim FOREIGN KEY (source_claim_id) REFERENCES sup_club_claims(claim_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
