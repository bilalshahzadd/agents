CREATE TABLE research_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  query text NOT NULL,
  summary text NOT NULL,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_briefs_brand_time_idx ON research_briefs(brand_id, created_at DESC);
