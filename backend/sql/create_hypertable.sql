-- Run once against your TigerData / TimescaleDB instance after
-- `flask db upgrade` has created the vitals_readings table.

SELECT create_hypertable('vitals_readings', 'recorded_at', if_not_exists => TRUE);

-- Optional: compress readings older than 7 days to save storage. Safe to
-- skip for a hackathon demo; useful if the app keeps running afterwards.
ALTER TABLE vitals_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'session_id'
);
SELECT add_compression_policy('vitals_readings', INTERVAL '7 days');
