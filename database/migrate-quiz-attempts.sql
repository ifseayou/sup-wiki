-- 记录每个用户对每道题的做题次数（用于智能派题）
USE sport_hacker;

CREATE TABLE IF NOT EXISTS sup_quiz_attempts (
  user_id     BIGINT NOT NULL,
  question_id INT    NOT NULL,
  attempt_count INT  NOT NULL DEFAULT 1,
  last_seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
