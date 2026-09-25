-- The initial publish applied the task rebuild and column additions before
-- reporting a duplicate source_record_id column. Live D1 inspection confirms
-- all intended columns exist. Record this migration without repeating DDL.
-- The packaged build contains only this 0012 migration.
SELECT 1;
