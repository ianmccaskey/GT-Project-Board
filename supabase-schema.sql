-- Run this in Supabase SQL Editor to set up your database schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Boards
create table boards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Columns
create table columns (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz default now()
);

-- Index for fetching columns in order
create index idx_columns_board_position on columns(board_id, position);

-- Index for fetching all columns of a board
create index idx_columns_board_id on columns(board_id);

-- Tags
create table tags (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1'
);

-- Index for fetching tags by board
create index idx_tags_board_id on tags(board_id);

-- Cards
create table cards (
  id uuid primary key default uuid_generate_v4(),
  column_id uuid references columns(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date timestamptz,
  tag_id uuid references tags(id) on delete set null,
  watchers uuid[] default '{}',
  deleted_at timestamptz,
  cover_image_url text,
  created_at timestamptz default now()
);

-- Index for fetching cards by board and column in order
create index idx_cards_board_column_position on cards(board_id, column_id, position);

-- Index for reordering cards within a column
create index idx_cards_column_position on cards(column_id, position);

-- Index for soft-delete filter
create index idx_cards_deleted_at on cards(deleted_at) where deleted_at is not null;

-- Card Tags (junction table)
create table card_tags (
  card_id uuid references cards(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (card_id, tag_id)
);

-- Index for fetching tags of a card
create index idx_card_tags_card_id on card_tags(card_id);

-- Index for fetching cards by tag
create index idx_card_tags_tag_id on card_tags(tag_id);

-- Members
create table members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  email text,
  color text not null
);

-- Agents
create table agents (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  description text,
  color text not null
);

-- Card member/agent associations (junction tables)
create table card_members (
  card_id uuid references cards(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (card_id, member_id)
);

create table card_agents (
  card_id uuid references cards(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  primary key (card_id, agent_id)
);

-- Milestones
create table milestones (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  name text not null,
  order_index int not null,
  color text,
  completed boolean default false
);

create index idx_milestones_card_id on milestones(card_id);

-- Checklists
create table checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  name text not null,
  order_index int not null
);

create index idx_checklists_card_id on checklists(card_id);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references checklists(id) on delete cascade,
  text text not null,
  done boolean default false,
  order_index int not null,
  milestone_id uuid references milestones(id) on delete set null,
  assignee_type text check (assignee_type in ('member', 'agent')),
  assignee_id uuid,
  due_date timestamptz
);

create index idx_checklist_items_checklist_id on checklist_items(checklist_id);

-- Comments
create table comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz default now(),
  updated_at timestamptz,
  edited boolean default false
);

create index idx_comments_card_id on comments(card_id);

-- Activity events
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create index idx_activity_events_card_id on activity_events(card_id);

-- Row Level Security
alter table boards enable row level security;
alter table columns enable row level security;
alter table tags enable row level security;
alter table cards enable row level security;
alter table card_tags enable row level security;
alter table members enable row level security;
alter table agents enable row level security;
alter table card_members enable row level security;
alter table card_agents enable row level security;
alter table milestones enable row level security;
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table comments enable row level security;
alter table activity_events enable row level security;

-- Helper function: is_board_owner(board_uuid)
create or replace function is_board_owner(board_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from boards where id = board_uuid and owner_id = auth.uid()
  );
$$ language sql security definer;

create policy "Users manage their boards"
  on boards for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users manage columns on their boards"
  on columns for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

create policy "Users manage tags on their boards"
  on tags for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

create policy "Users manage cards on their boards"
  on cards for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

create policy "Users manage card tags on their boards"
  on card_tags for all
  using (
    exists (
      select 1 from cards
      where cards.id = card_tags.card_id
      and is_board_owner(cards.board_id)
    )
  )
  with check (
    exists (
      select 1 from cards
      where cards.id = card_tags.card_id
      and is_board_owner(cards.board_id)
    )
  );

create policy "Users manage members on their boards"
  on members for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

create policy "Users manage agents on their boards"
  on agents for all
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

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

-- Comments are board-visible by default. Private comments are visible only to the author.
create policy "Users manage comments on their boards"
  on comments for all
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

-- Existing project migration:
-- alter table boards add column if not exists owner_id uuid references auth.users(id) on delete cascade;
