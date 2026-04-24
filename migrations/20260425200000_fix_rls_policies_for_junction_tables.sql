-- Fix: Recreate RLS policies for junction tables and card sub-tables
-- These may be missing or referencing a broken is_board_owner function

-- Ensure RLS is enabled
alter table card_members enable row level security;
alter table card_agents enable row level security;
alter table milestones enable row level security;
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table activity_events enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Users manage card_members on their boards" on card_members;
drop policy if exists "Users manage card_agents on their boards" on card_agents;
drop policy if exists "Users manage milestones on their boards" on milestones;
drop policy if exists "Users manage checklists on their boards" on checklists;
drop policy if exists "Users manage checklist_items on their boards" on checklist_items;
drop policy if exists "Users manage activity_events on their boards" on activity_events;

-- Card members
create policy "Users manage card_members on their boards"
  on card_members for all
  using (
    exists (
      select 1 from cards
      where cards.id = card_members.card_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from cards
      where cards.id = card_members.card_id
      and is_board_owner(cards.board_id)
    )
  );

-- Card agents
create policy "Users manage card_agents on their boards"
  on card_agents for all
  using (
    exists (
      select 1 from cards
      where cards.id = card_agents.card_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from cards
      where cards.id = card_agents.card_id
      and is_board_owner(cards.board_id)
    )
  );

-- Milestones
create policy "Users manage milestones on their boards"
  on milestones for all
  using (
    exists (
      select 1 from cards
      where cards.id = milestones.card_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from cards
      where cards.id = milestones.card_id
      and is_board_owner(cards.board_id)
    )
  );

-- Checklists
create policy "Users manage checklists on their boards"
  on checklists for all
  using (
    exists (
      select 1 from cards
      where cards.id = checklists.card_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from cards
      where cards.id = checklists.card_id
      and is_board_owner(cards.board_id)
    )
  );

-- Checklist items
create policy "Users manage checklist_items on their boards"
  on checklist_items for all
  using (
    exists (
      select 1 from checklists
      join cards on cards.id = checklists.card_id
      where checklists.id = checklist_items.checklist_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from checklists
      join cards on cards.id = checklists.card_id
      where checklists.id = checklist_items.checklist_id
      and is_board_owner(cards.board_id)
    )
  );

-- Activity events
create policy "Users manage activity_events on their boards"
  on activity_events for all
  using (
    exists (
      select 1 from cards
      where cards.id = activity_events.card_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from cards
      where cards.id = activity_events.card_id
      and is_board_owner(cards.board_id)
    )
  );
