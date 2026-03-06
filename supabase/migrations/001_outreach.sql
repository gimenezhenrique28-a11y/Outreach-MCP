-- Outreach contacts table for Wharf Outreach MCP
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE outreach_status AS ENUM ('pending', 'sent', 'replied', 'booked');

CREATE TABLE IF NOT EXISTS outreach_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  company      TEXT,
  role         TEXT,
  linkedin_url TEXT,
  apollo_id    TEXT UNIQUE,
  channel      TEXT DEFAULT 'email',
  status       outreach_status NOT NULL DEFAULT 'pending',
  message_sent TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER outreach_contacts_updated_at
  BEFORE UPDATE ON outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index for common query patterns
CREATE INDEX idx_outreach_contacts_status  ON outreach_contacts (status);
CREATE INDEX idx_outreach_contacts_company ON outreach_contacts (company);
CREATE INDEX idx_outreach_contacts_role    ON outreach_contacts (role);
