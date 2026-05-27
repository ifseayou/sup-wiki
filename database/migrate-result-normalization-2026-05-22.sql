USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_result_discipline_aliases (
  alias_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  alias VARCHAR(160) NOT NULL,
  normalized_key VARCHAR(80) NOT NULL,
  family ENUM('sprint','technical','distance','marathon','team','special','unknown') NOT NULL DEFAULT 'unknown',
  distance_min_m INT NULL,
  distance_max_m INT NULL,
  is_team_event TINYINT(1) NOT NULL DEFAULT 0,
  include_in_athlete_rating TINYINT(1) NOT NULL DEFAULT 0,
  confidence DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  note TEXT NULL,
  status ENUM('active','ignored','needs_review') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_discipline_alias (alias),
  INDEX idx_discipline_alias_key (normalized_key),
  INDEX idx_discipline_alias_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sup_result_group_aliases (
  alias_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  alias VARCHAR(160) NOT NULL,
  gender ENUM('male','female','mixed','open_unknown') NOT NULL DEFAULT 'open_unknown',
  age_band ENUM('u9','u12','u15','u16','u18','youth','college','open','masters','kahuna','adult_a','adult_b','unknown') NOT NULL DEFAULT 'unknown',
  competitive_tier ENUM('elite','open','mass','recreational','unknown') NOT NULL DEFAULT 'unknown',
  team_type ENUM('individual','dragon_board','relay','family','mixed_double','team','unknown') NOT NULL DEFAULT 'unknown',
  normalized_group_key VARCHAR(120) NOT NULL,
  confidence DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  note TEXT NULL,
  status ENUM('active','ignored','needs_review') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_group_alias (alias),
  INDEX idx_group_alias_key (normalized_group_key),
  INDEX idx_group_alias_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
