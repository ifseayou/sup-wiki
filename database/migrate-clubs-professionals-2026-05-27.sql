-- 俱乐部库 + 专业人员库 MVP
-- 目标：建立俱乐部、专业人员、成员关系、证书和关联经历的结构化底座。

CREATE TABLE IF NOT EXISTS sup_clubs (
  club_id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  logo VARCHAR(500) NULL,
  cover_image VARCHAR(500) NULL,
  images JSON NULL,
  province VARCHAR(80) NULL,
  city VARCHAR(80) NULL,
  district VARCHAR(80) NULL,
  address VARCHAR(255) NULL,
  water_area_name VARCHAR(160) NULL,
  water_type VARCHAR(80) NULL,
  lat DECIMAL(10,7) NULL,
  lng DECIMAL(10,7) NULL,
  intro TEXT NULL,
  services JSON NULL,
  safety_facilities JSON NULL,
  training_environment JSON NULL,
  opening_hours VARCHAR(160) NULL,
  contact_method VARCHAR(255) NULL,
  owner_user_id INT NULL,
  claim_status ENUM('unclaimed','pending','claimed','rejected') NOT NULL DEFAULT 'unclaimed',
  verification_status ENUM('unverified','pending','verified','expired','incomplete') NOT NULL DEFAULT 'unverified',
  source_type VARCHAR(80) NULL,
  source_note VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_clubs_status_sort (status, sort_order, club_id),
  INDEX idx_sup_clubs_city (province, city),
  INDEX idx_sup_clubs_verification (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_professionals (
  professional_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  athlete_id INT NULL,
  name VARCHAR(120) NOT NULL,
  avatar VARCHAR(500) NULL,
  gender VARCHAR(20) NULL,
  province VARCHAR(80) NULL,
  city VARCHAR(80) NULL,
  roles JSON NULL,
  primary_role VARCHAR(60) NOT NULL DEFAULT 'coach',
  club_id INT NULL,
  bio TEXT NULL,
  intro_short VARCHAR(255) NULL,
  specialties JSON NULL,
  service_items JSON NULL,
  teaching_level JSON NULL,
  teaching_environment JSON NULL,
  contact_visible TINYINT(1) NOT NULL DEFAULT 0,
  wechat_contact VARCHAR(120) NULL,
  phone_masked VARCHAR(80) NULL,
  claim_status ENUM('unclaimed','pending','claimed','rejected') NOT NULL DEFAULT 'unclaimed',
  verification_status ENUM('unverified','pending','verified','expired','incomplete') NOT NULL DEFAULT 'unverified',
  source_type VARCHAR(80) NULL,
  source_note VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_professionals_status_sort (status, sort_order, professional_id),
  INDEX idx_sup_professionals_role (primary_role),
  INDEX idx_sup_professionals_city (province, city),
  INDEX idx_sup_professionals_club (club_id),
  INDEX idx_sup_professionals_athlete (athlete_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_club_members (
  member_id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  professional_id INT NULL,
  athlete_id INT NULL,
  user_id INT NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'member',
  team_label VARCHAR(120) NULL,
  join_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_club_members_club (club_id, status, join_status),
  INDEX idx_sup_club_members_professional (professional_id),
  INDEX idx_sup_club_members_athlete (athlete_id),
  INDEX idx_sup_club_members_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_professional_certificates (
  certificate_id INT AUTO_INCREMENT PRIMARY KEY,
  professional_id INT NOT NULL,
  certificate_name VARCHAR(200) NOT NULL,
  certificate_type VARCHAR(100) NULL,
  certificate_level VARCHAR(100) NULL,
  issuer VARCHAR(160) NULL,
  issue_date DATE NULL,
  expiry_date DATE NULL,
  certificate_no_masked VARCHAR(120) NULL,
  certificate_image_url VARCHAR(500) NULL,
  source_type VARCHAR(80) NULL,
  verification_status ENUM('unverified','pending','verified','expired','incomplete') NOT NULL DEFAULT 'pending',
  remark VARCHAR(255) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_professional_certificates_profile (professional_id, status),
  INDEX idx_sup_professional_certificates_verify (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_professional_event_roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  professional_id INT NOT NULL,
  event_id INT NULL,
  event_name VARCHAR(255) NULL,
  year INT NULL,
  role_name VARCHAR(120) NOT NULL,
  event_level VARCHAR(120) NULL,
  source_url VARCHAR(500) NULL,
  verification_status ENUM('unverified','pending','verified','expired','incomplete') NOT NULL DEFAULT 'pending',
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_professional_event_roles_profile (professional_id, status),
  INDEX idx_sup_professional_event_roles_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_professional_course_links (
  link_id INT AUTO_INCREMENT PRIMARY KEY,
  professional_id INT NOT NULL,
  club_id INT NULL,
  course_id INT NULL,
  course_name VARCHAR(200) NULL,
  teaching_type VARCHAR(120) NULL,
  student_count INT NULL,
  location VARCHAR(180) NULL,
  record_date DATE NULL,
  source_type VARCHAR(80) NULL,
  verification_status ENUM('unverified','pending','verified','expired','incomplete') NOT NULL DEFAULT 'pending',
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sup_professional_course_links_profile (professional_id, status),
  INDEX idx_sup_professional_course_links_club (club_id),
  INDEX idx_sup_professional_course_links_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sup_club_courses (
  club_course_id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  course_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sup_club_courses (club_id, course_id),
  INDEX idx_sup_club_courses_club (club_id, status),
  INDEX idx_sup_club_courses_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO sup_clubs
  (slug, name, province, city, district, water_area_name, water_type, intro, services, safety_facilities, training_environment, contact_method, claim_status, verification_status, source_type, source_note, sort_order, status)
VALUES
  (
    'zhongliu-jishui-sup-club',
    '中流击水桨板俱乐部',
    '浙江省',
    '杭州市',
    '余杭区',
    '余杭塘河',
    '城市内河',
    '位于余杭塘河的桨板训练与体验据点，承接零基础体验、入门课程、竞速训练和亲子活动。',
    JSON_ARRAY('桨板课程','装备租赁','零基础体验','竞速训练','亲子活动'),
    JSON_ARRAY('救生衣','教练陪同','固定上下水点','限定活动区域'),
    JSON_ARRAY('静水训练','城市内河','入门友好','竞速训练'),
    '微信 i_add_u',
    'unclaimed',
    'unverified',
    'admin_seed',
    '课程模块默认场地',
    10,
    'published'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  province = VALUES(province),
  city = VALUES(city),
  district = VALUES(district),
  water_area_name = VALUES(water_area_name),
  services = VALUES(services),
  safety_facilities = VALUES(safety_facilities),
  training_environment = VALUES(training_environment),
  contact_method = VALUES(contact_method),
  status = VALUES(status);

INSERT INTO sup_club_courses (club_id, course_id, sort_order, status)
SELECT c.club_id, co.course_id, co.sort_order, 'published'
FROM sup_clubs c
JOIN sup_courses co ON (co.venue LIKE '%中流击水%' OR co.venue LIKE '%余杭塘河%')
WHERE c.slug = 'zhongliu-jishui-sup-club'
ON DUPLICATE KEY UPDATE
  sort_order = VALUES(sort_order),
  status = VALUES(status);
