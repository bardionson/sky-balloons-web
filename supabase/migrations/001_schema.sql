-- Settings: admin-controlled key/value pairs
CREATE TABLE IF NOT EXISTS settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Collectors: one record per buyer (upsert on email)
CREATE TABLE IF NOT EXISTS collectors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  name            text NOT NULL,
  wallet_address  text,
  street_address  text,
  city            text,
  state           text,
  postal_code     text,
  country         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Mints: one record per balloon artwork from the installation
CREATE TABLE IF NOT EXISTS mints (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- GAN metadata from GPU
  cid              text NOT NULL,
  unique_name      text NOT NULL,
  unit_number      integer NOT NULL,
  seed             bigint NOT NULL,
  timestamp        text NOT NULL,
  orientation      smallint NOT NULL CHECK (orientation IN (0, 1)),
  imagination      integer NOT NULL,
  event_name       text NOT NULL,
  type             text NOT NULL DEFAULT 'Standard',
  pixel_dimensions text NOT NULL DEFAULT '1920x1080',
  -- Payment & delivery state
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','ordered','paid','minting','minted','printed','failed')),
  order_id         text,
  token_id         text,
  tx_hash          text,
  collector_id     uuid REFERENCES collectors(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Webhook events: audit log of all inbound provider webhooks
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  event_type   text NOT NULL,
  order_id     text,
  payload      jsonb NOT NULL,
  processed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on mints and collectors
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mints_updated_at
  BEFORE UPDATE ON mints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER collectors_updated_at
  BEFORE UPDATE ON collectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for GPU polling and cron job
CREATE INDEX mints_status_idx ON mints (status);
CREATE INDEX mints_order_id_idx ON mints (order_id) WHERE order_id IS NOT NULL;
