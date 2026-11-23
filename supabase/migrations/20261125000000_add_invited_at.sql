alter table public.guests
  add column invited_at timestamptz,
  add column invitation_claim_id uuid,
  add column invitation_claimed_at timestamptz,
  add constraint guests_invitation_claim_pair check (
    (invitation_claim_id is null) = (invitation_claimed_at is null)
  );
