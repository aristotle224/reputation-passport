-- reputation-passport initial schema
-- Mirrors the on-chain Attestation and Worker/Issuer structs from README.md Data Model.
-- Run via: pnpm run migrate

CREATE TABLE IF NOT EXISTS issuers (
  id            SERIAL PRIMARY KEY,
  address       TEXT NOT NULL UNIQUE,
  stake         NUMERIC(30,0) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'delisted')),
  registered_at TIMESTAMPTZ,
  ledger_sequence INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id            SERIAL PRIMARY KEY,
  address       TEXT NOT NULL UNIQUE,
  metadata_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attestations (
  id              SERIAL PRIMARY KEY,
  issuer_address  TEXT NOT NULL,
  subject_address TEXT NOT NULL,
  nonce           BIGINT NOT NULL,
  job_type        TEXT NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 500),
  weight          INTEGER NOT NULL CHECK (weight > 0),
  timestamp       BIGINT NOT NULL,   -- on-chain ledger timestamp (Unix seconds)
  evidence_hash   TEXT,
  revoked         BOOLEAN NOT NULL DEFAULT FALSE,
  ledger_sequence INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (issuer_address, subject_address, nonce)
);

CREATE TABLE IF NOT EXISTS indexer_state (
  id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  last_indexed_ledger  INTEGER NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO indexer_state (id, last_indexed_ledger)
VALUES (1, 0)
ON CONFLICT DO NOTHING;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_attestations_subject
  ON attestations(subject_address);
CREATE INDEX IF NOT EXISTS idx_attestations_issuer
  ON attestations(issuer_address);
CREATE INDEX IF NOT EXISTS idx_attestations_job_type
  ON attestations(job_type);
CREATE INDEX IF NOT EXISTS idx_attestations_timestamp
  ON attestations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attestations_subject_active
  ON attestations(subject_address) WHERE revoked = FALSE;
