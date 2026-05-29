CREATE TABLE IF NOT EXISTS sup_mini_feedback (
  feedback_id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NULL,
  nickname VARCHAR(120) NULL,
  bug_text TEXT NULL,
  feature_text TEXT NULL,
  rating TINYINT NULL,
  willing_to_share TINYINT NULL,
  image_urls JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id),
  KEY idx_user_created (user_id, created_at),
  KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sup_mini_announcements (
  announcement_id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  ticker VARCHAR(220) NULL,
  detail TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id),
  KEY idx_status_sort (status, sort_order, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
