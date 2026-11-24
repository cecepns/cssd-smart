-- =============================================================================
-- PERBAIKAN DATA NOMOR DOKUMEN BMHP (doc_number = 'undefined')
-- Jalankan di phpMyAdmin cPanel database kinq6231_cssd-smart
-- =============================================================================

UPDATE `bmhp_transactions`
SET 
  `doc_number` = CONCAT('BMHP-OUT-', DATE_FORMAT(COALESCE(`trx_date`, CURDATE()), '%y%m%d'), '-', LPAD(`id`, 3, '0')),
  `doc_type` = 'NPB',
  `receiver_name` = CASE 
    WHEN `receiver_name` = 'undefined' OR `receiver_name` IS NULL THEN 'Petugas CSSD' 
    ELSE `receiver_name` 
  END
WHERE `doc_number` = 'undefined' 
   OR `doc_number` LIKE '%undefined%' 
   OR `doc_number` IS NULL 
   OR `doc_number` = '';
