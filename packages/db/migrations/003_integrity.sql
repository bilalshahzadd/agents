ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_time_order_chk CHECK (end_at > start_at);

ALTER TABLE content_items
  ADD CONSTRAINT content_scheduled_requirements_chk
  CHECK (status <> 'scheduled' OR (social_account_id IS NOT NULL AND scheduled_at IS NOT NULL));

ALTER TABLE social_accounts
  ADD CONSTRAINT social_accounts_status_chk CHECK (status IN ('connected','disconnected','revoked','error'));

CREATE UNIQUE INDEX agent_profiles_brand_name_key ON agent_profiles(brand_id, name);

CREATE OR REPLACE FUNCTION validate_content_social_account()
RETURNS trigger AS $$
DECLARE
  campaign_brand uuid;
  account_brand uuid;
  account_platform social_platform;
BEGIN
  IF NEW.social_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT brand_id INTO campaign_brand FROM campaigns WHERE id=NEW.campaign_id;
  SELECT brand_id,platform INTO account_brand,account_platform FROM social_accounts WHERE id=NEW.social_account_id;
  IF account_brand IS NULL OR account_brand <> campaign_brand OR account_platform <> NEW.platform THEN
    RAISE EXCEPTION 'social account must match content campaign brand and platform';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_social_account_integrity
BEFORE INSERT OR UPDATE OF campaign_id,social_account_id,platform ON content_items
FOR EACH ROW EXECUTE FUNCTION validate_content_social_account();
