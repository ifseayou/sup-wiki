-- SUP Wiki 用户桨板训练数据
-- 与 src/lib/training-db.ts 保持一致；线上可显式执行，也可由 API 首次访问自动建表。

CREATE TABLE IF NOT EXISTS sup_training_sessions (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT '桨板训练',
  activity_type VARCHAR(32) NOT NULL DEFAULT 'sup',
  started_at DATETIME NULL,
  duration_seconds INT NULL,
  moving_time_seconds INT NULL,
  elapsed_time_seconds INT NULL,
  distance_km DECIMAL(8,2) NULL,
  avg_pace_sec_per_km INT NULL,
  avg_moving_pace_sec_per_km INT NULL,
  best_pace_sec_per_km INT NULL,
  avg_speed_kmh DECIMAL(6,2) NULL,
  max_speed_kmh DECIMAL(6,2) NULL,
  avg_heart_rate INT NULL,
  max_heart_rate INT NULL,
  stroke_count INT NULL,
  avg_stroke_rate INT NULL,
  max_stroke_rate INT NULL,
  avg_stroke_distance_m DECIMAL(6,2) NULL,
  training_effect_aerobic DECIMAL(3,1) NULL,
  training_effect_anaerobic DECIMAL(3,1) NULL,
  training_load INT NULL,
  intensity_minutes_moderate INT NULL,
  intensity_minutes_vigorous INT NULL,
  body_battery_impact INT NULL,
  raw_ocr_json JSON NULL,
  status ENUM('draft','confirmed') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_training_user_created (user_id, created_at),
  CONSTRAINT fk_training_sessions_user FOREIGN KEY (user_id) REFERENCES sup_users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_training_session_images (
  image_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NULL,
  user_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  ocr_text MEDIUMTEXT NULL,
  ocr_json JSON NULL,
  source_app VARCHAR(32) NOT NULL DEFAULT 'garmin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_training_images_user (user_id, created_at),
  INDEX idx_training_images_session (session_id),
  CONSTRAINT fk_training_images_user FOREIGN KEY (user_id) REFERENCES sup_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_training_images_session FOREIGN KEY (session_id) REFERENCES sup_training_sessions(session_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_training_laps (
  lap_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  lap_no INT NOT NULL,
  time_seconds INT NULL,
  distance_km DECIMAL(8,2) NULL,
  avg_pace_sec_per_km INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_training_lap (session_id, lap_no),
  CONSTRAINT fk_training_laps_session FOREIGN KEY (session_id) REFERENCES sup_training_sessions(session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
