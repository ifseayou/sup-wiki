USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_event_result_submissions (
  submission_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  event_id BIGINT NULL,
  event_name VARCHAR(160) NOT NULL,
  event_date DATE NULL,
  location VARCHAR(160) NULL,
  file_url VARCHAR(700) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  size_bytes INT NOT NULL DEFAULT 0,
  user_note TEXT NULL,
  status ENUM('pending','reviewing','imported','rejected') NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_result_submissions_status_created (status, created_at),
  INDEX idx_result_submissions_user (user_id, created_at),
  INDEX idx_result_submissions_event (event_id, created_at),
  CONSTRAINT fk_result_submissions_user FOREIGN KEY (user_id) REFERENCES sup_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_result_submissions_event FOREIGN KEY (event_id) REFERENCES sup_events(event_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
