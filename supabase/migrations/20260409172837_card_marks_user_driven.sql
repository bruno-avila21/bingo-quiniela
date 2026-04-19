-- Add validated column: false = user-marked (pending), true = confirmed by nightly cron
alter table card_marks add column validated boolean not null default false;

-- Allow authenticated users to insert marks for their own paid cards
create policy "card_marks_own_insert" on card_marks for insert
  with check (
    exists (
      select 1 from cards
      where cards.id = card_marks.card_id
        and cards.user_id = auth.uid()
        and cards.paid = true
    )
  );

-- Allow users to delete their own unvalidated (pending) marks only
create policy "card_marks_own_delete" on card_marks for delete
  using (
    exists (
      select 1 from cards
      where cards.id = card_marks.card_id
        and cards.user_id = auth.uid()
    )
    and validated = false
  );
