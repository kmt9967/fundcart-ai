-- Allow purchase approvals that are not tied to a campaign (direct "Buy (sandbox)" checkout).
alter table purchase_approvals alter column campaign_id drop not null;
