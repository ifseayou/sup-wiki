-- SUP Wiki — seed reusable local illustration images into media library

USE sport_hacker;

INSERT INTO sup_media_assets (url, folder, filename, mime_type, alt_text, source_context, status) VALUES
('/quiz-images/correct-stance.svg','courses','correct-stance.svg','image/svg+xml','桨板站姿示意','seed','active'),
('/quiz-images/pfd-types.svg','courses','pfd-types.svg','image/svg+xml','救生衣类型示意','seed','active'),
('/quiz-images/paddle-stroke-angle.svg','courses','paddle-stroke-angle.svg','image/svg+xml','划桨角度示意','seed','active'),
('/quiz-images/paddle-blade-direction.svg','courses','paddle-blade-direction.svg','image/svg+xml','桨叶方向示意','seed','active'),
('/quiz-images/board-types-overview.svg','courses','board-types-overview.svg','image/svg+xml','桨板类型示意','seed','active'),
('/quiz-images/fin-types.svg','courses','fin-types.svg','image/svg+xml','尾鳍类型示意','seed','active')
ON DUPLICATE KEY UPDATE
folder = VALUES(folder),
filename = VALUES(filename),
mime_type = VALUES(mime_type),
alt_text = VALUES(alt_text),
source_context = VALUES(source_context),
status = VALUES(status);
