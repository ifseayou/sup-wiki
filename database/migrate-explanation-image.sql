-- 为题目解析区增加配图 URL 字段
ALTER TABLE sup_quiz_questions
  ADD COLUMN explanation_image VARCHAR(500) NULL COMMENT '解析配图 URL（/quiz-images/*.svg 或 OSS 链接）'
  AFTER explanation;
