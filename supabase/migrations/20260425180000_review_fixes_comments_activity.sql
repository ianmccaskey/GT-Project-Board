-- Review fixes: comments visibility + activity_events FK + RLS for new tables

-- 1. Add visibility column to comments for privacy controls
alter table comments add column if not exists visibility text not null default 'public' check (visibility in ('public', 'private'));

-- 2. Add FK on activity_events.actor_id to auth.users (nullable for system events)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'activity_events_actor_id_fkey'
    and table_name = 'activity_events'
  ) then
    alter table activity_events
      add constraint activity_events_actor_id_fkey
      foreign key (actor_id) references auth.users(id) on delete set null;
  end if;
end $$;

-- 3. Ensure RLS is enabled on new tables
alter table if exists members enable row level security;
alter table if exists agents enable row level security;
alter table if exists card_members enable row level security;
alter table if exists card_agents enable row level security;
alter table if exists milestones enable row level security;
alter table if exists checklists enable row level security;
alter table if exists checklist_items enable row level security;
alter table if exists activity_events enable row level security;

-- 4. Helper function for board ownership checks (idempotent)
create or replace function is_board_owner(board_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from boards where id = board_uuid and owner_id = auth.uid()
  );
$$ language sql security definer;

-- 5. Add missing RLS policies for new tables (safe re-run via DO blocks)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users manage members on their boards' and tablename = 'members') then
    create policy "Users manage members on their boards" on members for all using (is_board_owner(board_id)) with check (is_board_owner(board_id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage agents on their boards' and tablename = 'agents') then
    create policy "Users manage agents on their boards" on agents for all using (is_board_owner(board_id)) with check (is_board_owner(board_id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage card_members on their boards' and tablename = 'card_members') then
    create policy "Users manage card_members on their boards" on card_members for all using (exists (select 1 from cards where cards.id = card_members.card_id and is_board_owner(cards.board_id))) with check (exists (select 1 from cards where cards.id = card_members.card_id and is_board_owner(cards.board_id)));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage card_agents on their boards' and tablename = 'card_agents') then
    create policy "Users manage card_agents on their boards" on card_agents for all using (exists (select 1 from cards where cards.id = card_agents.card_id and is_board_owner(cards.board_id))) with check (exists (select 1 from cards where cards.id = card_agents.card_id and is_board_owner(cards.board_id)));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage milestones on their boards' and tablename = 'milestones') then
    create policy "Users manage milestones on their boards" on milestones for all using (exists (select 1 from cards where cards.id = milestones.card_id and is_board_owner(cards.board_id))) with check (exists (select 1 from cards where cards.id = milestones.card_id and is_board_owner(cards.board_id)));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage checklists on their boards' and tablename = 'checklists') then
    create policy "Users manage checklists on their boards" on checklists for all using (exists (select 1 from cards where cards.id = checklists.card_id and is_board_owner(cards.board_id))) with check (exists (select 1 from cards where cards.id = checklists.card_id and is_board_owner(cards.board_id)));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage checklist_items on their boards' and tablename = 'checklist_items') then
    create policy "Users manage checklist_items on their boards" on checklist_items for all using (exists (select 1 from checklists join cards on cards.id = checklists.card_id where checklists.id = checklist_items.checklist_id and is_board_owner(cards.board_id))) with check (exists (select 1 from checklists join cards on cards.id = checklists.card_id where checklists.id = checklist_items.checklist_id and is_board_owner(cards.board_id)));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users manage activity_events on their boards' and tablename = 'activity_events') then
    create policy "Users manage activity_events on their boards" on activity_events for all using (exists (select 1 from cards where cards.id = activity_events.card_id and is_board_owner(cards.board_id))) with check (exists (select 1 from cards where cards.id = activity_events.card_id and is_board_owner(cards.board_id)));
  end if;
end $$;

-- 6. Update comments policy to respect visibility (drop and recreate to avoid duplicates)
do $$
begin
  if exists (select 1 from pg_policies where policyname = 'Users manage comments on their boards' and tablename = 'comments') then
    drop policy "Users manage comments on their boards" on comments;
  end if;
  create policy "Users manage comments on their boards" on comments for all
    using (
      exists (
        select 1 from cards
        where cards.id = comments.card_id
        and is_board_owner(cards.board_id)
      )
      and (comments.visibility = 'public' or comments.author_id = auth.uid())
    )
    with check (
      exists (
        select 1 from cards
        where cards.id = comments.card_id
        and is_board_owner(cards.board_id)
      )
    );
end $$;
