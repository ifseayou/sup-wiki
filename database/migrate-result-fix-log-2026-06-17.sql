-- 成绩录入修复审计/回滚日志（参照 sup_event_merge_log / sup_athlete_merge_log）
-- 记录每一行成绩的字段级修改（relabel 改组 / rerank 改名次 / delete 删除重复行）+ 修改前快照，按 batch_id 回滚。
CREATE TABLE IF NOT EXISTS sup_result_fix_log (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id VARCHAR(48) NOT NULL,
  operation ENUM('relabel','rerank','delete','field') NOT NULL,
  result_id BIGINT NOT NULL,
  event_id BIGINT NULL,
  field_name VARCHAR(40) NULL COMMENT 'relabel=gender_group/discipline/round_label; rerank=rank_position; delete=NULL',
  old_value VARCHAR(255) NULL,
  new_value VARCHAR(255) NULL,
  snapshot JSON NULL COMMENT 'delete 操作整行快照，用于回滚还原',
  note VARCHAR(255) NULL,
  rolled_back TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_result_fix_batch (batch_id),
  INDEX idx_result_fix_result (result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
