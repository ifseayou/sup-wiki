ALTER TABLE sup_annual_point_sources
  ADD COLUMN point_scope ENUM('domestic','international') NOT NULL DEFAULT 'domestic' AFTER year;

CREATE TABLE IF NOT EXISTS sup_annual_point_import_cache (
  cache_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cache_key VARCHAR(120) NOT NULL,
  source_key VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL,
  record_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_annual_point_import_cache_key (cache_key),
  INDEX idx_annual_point_import_cache_source (source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
