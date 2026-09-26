-- Run once against your TigerData / TimescaleDB instance after
-- `flask db upgrade` has created the vitals_readings and rep_events tables.
-- Safe to re-run.

SELECT create_hypertable('vitals_readings', 'recorded_at', if_not_exists => TRUE);
SELECT create_hypertable('rep_events', 'recorded_at', if_not_exists => TRUE);

-- Optional: compress rows older than 7 days to save storage. Safe to
-- skip for a hackathon demo; useful if the app keeps running afterwards.
ALTER TABLE vitals_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'session_id'
);
SELECT add_compression_policy('vitals_readings', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE rep_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'session_id'
);
SELECT add_compression_policy('rep_events', INTERVAL '7 days', if_not_exists => TRUE);
