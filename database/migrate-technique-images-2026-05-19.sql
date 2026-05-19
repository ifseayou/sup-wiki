-- SUP Wiki — technique library images

USE sport_hacker;

ALTER TABLE sup_techniques
  ADD COLUMN cover_image VARCHAR(500) NULL AFTER name,
  ADD COLUMN images JSON NULL AFTER cover_image;
