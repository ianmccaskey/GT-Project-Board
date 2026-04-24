-- Indexes on card_id for the hot paths queried when opening a card modal.
-- Without these, queries on milestones, checklists, comments, and activity_events
-- do a sequential scan on larger boards.

create index if not exists idx_milestones_card_id on milestones(card_id);
create index if not exists idx_checklists_card_id on checklists(card_id);
create index if not exists idx_checklist_items_checklist_id on checklist_items(checklist_id);
create index if not exists idx_comments_card_id on comments(card_id);
create index if not exists idx_activity_events_card_id on activity_events(card_id);

-- Index on cards.deleted_at to keep the soft-delete filter fast
create index if not exists idx_cards_deleted_at on cards(deleted_at) where deleted_at is not null;
