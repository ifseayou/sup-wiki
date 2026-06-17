-- 运动员身份治理审计/回滚日志（Phase 3）
-- 记录 合并/迁移/拆分 时每一行成绩/积分/认领的 athlete_id 变更（from->to），
-- 以及合并时被删除草稿档案的整行快照，用于按 batch_id 整批回滚。
CREATE TABLE IF NOT EXISTS sup_athlete_merge_log (
  log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  batch_id VARCHAR(40) NOT NULL COMMENT '一次操作的批次号，回滚以此为单位',
  operation ENUM('merge','transfer','split') NOT NULL,
  table_name VARCHAR(64) NOT NULL COMMENT '被改动的表；sup_athletes 表示被删除档案的整行快照',
  pk_column VARCHAR(32) NOT NULL COMMENT '该表主键列名',
  row_pk BIGINT NOT NULL COMMENT '被改动行主键',
  from_athlete_id BIGINT NULL COMMENT '原 athlete_id（可为空，表示原为同名快照未关联）',
  to_athlete_id BIGINT NULL COMMENT '新 athlete_id',
  snapshot JSON NULL COMMENT '被删除档案整行快照（仅 table_name=sup_athletes 时）',
  admin_user_id BIGINT NULL,
  note VARCHAR(255) NULL,
  rolled_back TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merge_log_batch (batch_id),
  INDEX idx_merge_log_row (table_name, row_pk),
  INDEX idx_merge_log_to (to_athlete_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
