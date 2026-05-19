-- SUP Wiki — courses + technique library
-- Run in sport_hacker database.

USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_techniques (
    technique_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_code VARCHAR(20) UNIQUE NULL COMMENT '来自 35 项考核清单的编号，如 01',
    name VARCHAR(120) NOT NULL,
    stage TINYINT NOT NULL DEFAULT 1,
    stage_label VARCHAR(80) NOT NULL,
    level ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
    category VARCHAR(60) DEFAULT 'general',
    points INT DEFAULT 1,
    key_points TEXT,
    common_errors TEXT,
    sort_order INT DEFAULT 0,
    status ENUM('draft','published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_techniques_stage (stage),
    INDEX idx_techniques_level (level),
    INDEX idx_techniques_category (category),
    INDEX idx_techniques_status (status),
    INDEX idx_techniques_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sup_courses (
    course_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(120) UNIQUE NOT NULL,
    title VARCHAR(120) NOT NULL,
    subtitle VARCHAR(200),
    summary TEXT,
    description TEXT,
    venue VARCHAR(200) DEFAULT '中流击水桨板俱乐部（余杭塘河-梦想小镇段）',
    schedule_note VARCHAR(200) DEFAULT '课程时间和教练自行约定',
    equipment_note VARCHAR(300),
    board_note VARCHAR(200),
    duration_minutes INT,
    price_display VARCHAR(200),
    price_options JSON,
    sort_order INT DEFAULT 0,
    status ENUM('draft','published') DEFAULT 'published',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_courses_status (status),
    INDEX idx_courses_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sup_course_techniques (
    course_id BIGINT NOT NULL,
    technique_id BIGINT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, technique_id),
    INDEX idx_course_techniques_technique (technique_id),
    CONSTRAINT fk_course_techniques_course FOREIGN KEY (course_id) REFERENCES sup_courses(course_id) ON DELETE CASCADE,
    CONSTRAINT fk_course_techniques_technique FOREIGN KEY (technique_id) REFERENCES sup_techniques(technique_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
