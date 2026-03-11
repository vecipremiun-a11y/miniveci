-- SQLite does not support ALTER COLUMN, so we recreate via a temporary column approach.
-- However, SQLite's type affinity means INTEGER columns already accept REAL values.
-- This migration is a no-op marker; the schema change in Drizzle is what matters.
-- SQLite stores REAL values even in INTEGER-affinity columns, so existing data is safe.

-- Marker: web_stock column is now treated as REAL in the application layer.
SELECT 1;
