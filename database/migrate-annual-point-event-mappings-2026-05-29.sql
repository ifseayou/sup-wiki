-- SUP Wiki — map annual point source event names to local events

CREATE TABLE IF NOT EXISTS sup_annual_point_event_mappings (
  mapping_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_id BIGINT NOT NULL,
  year INT NOT NULL,
  point_event_name VARCHAR(260) NOT NULL,
  normalized_name VARCHAR(260) NOT NULL,
  star_level INT NULL,
  point_rows_count INT DEFAULT 0,
  athlete_count INT DEFAULT 0,
  total_point_sum DECIMAL(14,3) DEFAULT 0,
  matched_event_id BIGINT NULL,
  candidate_events JSON NULL,
  match_status ENUM('unmatched','candidate','confirmed','ignored') DEFAULT 'unmatched',
  match_confidence DECIMAL(4,3) DEFAULT 0.000,
  match_reason VARCHAR(255) NULL,
  admin_note TEXT NULL,
  last_analyzed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_annual_point_event_source_name (source_id, point_event_name),
  INDEX idx_annual_point_event_status (match_status),
  INDEX idx_annual_point_event_matched_event (matched_event_id),
  INDEX idx_annual_point_event_year (year),
  CONSTRAINT fk_annual_point_event_source FOREIGN KEY (source_id) REFERENCES sup_annual_point_sources(source_id) ON DELETE CASCADE,
  CONSTRAINT fk_annual_point_event_matched_event FOREIGN KEY (matched_event_id) REFERENCES sup_events(event_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
