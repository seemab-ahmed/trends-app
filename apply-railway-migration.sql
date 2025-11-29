-- Apply missing fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_advisor boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_predictions integer DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accuracy_percentage decimal(5,2) DEFAULT '0.00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_badge text;

-- Apply missing field to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sentiment text;

-- Create opinions table if it doesn't exist
CREATE TABLE IF NOT EXISTS opinions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  sentiment text NOT NULL,
  prediction text NOT NULL,
  created_at timestamp DEFAULT now()
);
