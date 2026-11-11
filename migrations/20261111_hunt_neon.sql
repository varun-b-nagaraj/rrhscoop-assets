-- Dragon hunt tables. Everything lives in its own "hunt" schema, apart from the Digital Pass data.
-- Safe to run more than once.
CREATE SCHEMA IF NOT EXISTS hunt;
REVOKE ALL ON SCHEMA hunt FROM PUBLIC;
-- One row per promo ID (RRHS_HUNT_PROMO_ID). A reset bumps epoch, so older claims never count again.
CREATE TABLE IF NOT EXISTS hunt.promotions (
 id text PRIMARY KEY, epoch integer NOT NULL DEFAULT 1,
 lifecycle text NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','resetting')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- The unique constraints are the real guarantee: one reward per person and one per dragon.
CREATE TABLE IF NOT EXISTS hunt.claims (
 id uuid PRIMARY KEY, promo_id text NOT NULL REFERENCES hunt.promotions(id), epoch integer NOT NULL,
 student_key text NOT NULL, egg_id text NOT NULL, request_key uuid NOT NULL,
 identity_cipher text NOT NULL, percentage integer NOT NULL CHECK (percentage IN (10,15,20,25,35)),
 code_cipher text NOT NULL, coupon_id text,
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','issued','fulfilled','attention')),
 email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent')),
 attempts integer NOT NULL DEFAULT 0, lease uuid, lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (promo_id,epoch,student_key), UNIQUE (promo_id,epoch,egg_id), UNIQUE (promo_id,epoch,request_key)
);
CREATE TABLE IF NOT EXISTS hunt.events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, promo_id text NOT NULL,
 claim_id uuid REFERENCES hunt.claims(id) ON DELETE SET NULL, event text NOT NULL, detail text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hunt_events_promo_time ON hunt.events (promo_id,id DESC);
-- Dashboard sign-in codes and sessions.
CREATE TABLE IF NOT EXISTS hunt.challenges (
 id uuid PRIMARY KEY, subject_key text NOT NULL, code_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS hunt_challenges_subject ON hunt.challenges (subject_key);
CREATE TABLE IF NOT EXISTS hunt.sessions (token_hash text PRIMARY KEY, email_cipher text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS hunt.limits (key text PRIMARY KEY, promo_id text NOT NULL, count integer NOT NULL, expires_at timestamptz NOT NULL);
