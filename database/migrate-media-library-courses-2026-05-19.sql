-- SUP Wiki — media library + course images

USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_media_assets (
    asset_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(700) NOT NULL,
    folder VARCHAR(100) DEFAULT 'misc',
    filename VARCHAR(255),
    mime_type VARCHAR(100),
    size_bytes INT,
    alt_text VARCHAR(300),
    source_context VARCHAR(100),
    status ENUM('active','hidden') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_media_url (url),
    INDEX idx_media_folder (folder),
    INDEX idx_media_status (status),
    INDEX idx_media_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sup_courses
  ADD COLUMN cover_image VARCHAR(500) NULL AFTER description,
  ADD COLUMN images JSON NULL AFTER cover_image;
