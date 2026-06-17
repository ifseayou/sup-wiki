-- 赛事合并审计/回滚日志（参照 sup_athlete_merge_log）
-- 记录合并时每一行从 from_event_id 重指到 to_event_id 的变更 + 被合并 event 的草稿化快照，按 batch_id 回滚。
CREATE TABLE IF NOT EXISTS sup_event_merge_log (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id VARCHAR(40) NOT NULL,
  operation ENUM('merge') NOT NULL DEFAULT 'merge',
  table_name VARCHAR(64) NOT NULL COMMENT '被改动表；sup_events 表示被合并event的状态快照',
  pk_column VARCHAR(32) NOT NULL,
  row_pk BIGINT NOT NULL,
  fk_column VARCHAR(32) NOT NULL DEFAULT 'event_id' COMMENT '该表指向赛事的列名',
  from_event_id BIGINT NULL,
  to_event_id BIGINT NULL,
  snapshot JSON NULL COMMENT '被合并 event 草稿化前的 status/event_status/name 快照',
  note VARCHAR(255) NULL,
  rolled_back TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_merge_batch (batch_id),
  INDEX idx_event_merge_to (to_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
