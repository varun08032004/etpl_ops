-- Migration 002: Platform Sync Tables
-- Run AFTER base schema.sql (which creates chart_of_accounts, journal_entries, staff_accounts)
-- Creates tables for idempotent platform revenue sync

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PLATFORM SYNC LOG
-- One row per platform record imported (subscription payment or trade fee)
-- UNIQUE constraint on (source, ref_id) enforces idempotency
CREATE TABLE IF NOT EXISTS platform_sync_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source            VARCHAR(30) NOT NULL,                    -- 'subscription' | 'trade_fee'
  ref_id            VARCHAR(100) NOT NULL,                   -- platform's unique ID for this record
  amount_inr        NUMERIC(14,2) NOT NULL,                  -- total amount (incl GST)
  gst_inr           NUMERIC(14,2) NOT NULL DEFAULT 0,        -- total GST component
  cgst_inr          NUMERIC(14,2) NOT NULL DEFAULT 0,        -- CGST component
  sgst_inr          NUMERIC(14,2) NOT NULL DEFAULT 0,        -- SGST component
  igst_inr          NUMERIC(14,2) NOT NULL DEFAULT 0,        -- IGST component
  entry_date        DATE NOT NULL,                           -- the revenue date from platform
  journal_entry_id  UUID REFERENCES journal_entries(id),     -- linked JE in our ledger
  synced_by         UUID REFERENCES staff_accounts(id),      -- who clicked "Sync"
  synced_at         TIMESTAMP DEFAULT NOW(),                 -- when this record was synced
  -- Platform metadata for display
  customer_email    VARCHAR(255),
  buyer_email       VARCHAR(255),
  seller_email      VARCHAR(255),
  project_name      VARCHAR(255),
  quantity_tco2     NUMERIC(10,4),
  plan              VARCHAR(50),
  cycle             VARCHAR(20),
  description       TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(source, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_sync_log_date ON platform_sync_log(entry_date);
CREATE INDEX IF NOT EXISTS idx_platform_sync_log_je ON platform_sync_log(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_platform_sync_log_synced_at ON platform_sync_log(synced_at);

-- PLATFORM SYNC RUNS
-- One row per "Sync from Platform" button click (summary of the batch)
CREATE TABLE IF NOT EXISTS platform_sync_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_month      INTEGER NOT NULL,                        -- 1-12
  period_year       INTEGER NOT NULL,
  records_synced    INTEGER NOT NULL DEFAULT 0,              -- newly imported this run
  records_skipped   INTEGER NOT NULL DEFAULT 0,              -- already existed (idempotent)
  records_failed    INTEGER NOT NULL DEFAULT 0,              -- errors
  total_amount_inr  NUMERIC(14,2) NOT NULL DEFAULT 0,        -- sum of amount_inr for newly synced
  run_by            UUID REFERENCES staff_accounts(id),      -- who triggered the sync
  run_at            TIMESTAMP DEFAULT NOW(),                 -- when the sync was run
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_sync_runs_period ON platform_sync_runs(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_platform_sync_runs_run_at ON platform_sync_runs(run_at);