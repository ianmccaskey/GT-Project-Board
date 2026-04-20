-- Run this in Supabase SQL Editor to set up your database schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Boards
create table boards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
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
  due_date date,
  created_at timestamptz default now()
);

-- Index for fetching cards by board and column in order
create index idx_cards_board_column_position on cards(board_id, column_id, position);

-- Index for reordering cards within a column
create index idx_cards_column_position on cards(column_id, position);

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

-- Comments
create table comments (
  id uuid primary key default uuid_generate_v4(),
  card_id uuid references cards(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- Index for fetching comments of a card
create index idx_comments_card_id on comments(card_id);

-- Row Level Security (disabled for now - no auth)
alter table boards enable row level security;
alter table columns enable row level security;
alter table tags enable row level security;
alter table cards enable row level security;
alter table card_tags enable row level security;
alter table comments enable row level security;

-- Allow all operations (no auth)
create policy "Allow all boards" on boards for all using (true) with check (true);
create policy "Allow all columns" on columns for all using (true) with check (true);
create policy "Allow all tags" on tags for all using (true) with check (true);
create policy "Allow all cards" on cards for all using (true) with check (true);
create policy "Allow all card_tags" on card_tags for all using (true) with check (true);
create policy "Allow all comments" on comments for all using (true) with check (true);

-- Insert a default board with columns
insert into boards (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'My First Board');

insert into columns (board_id, name, position) values
  ('11111111-1111-1111-1111-111111111111', 'Backlog', 0),
  ('11111111-1111-1111-1111-111111111111', 'In Progress', 1),
  ('11111111-1111-1111-1111-111111111111', 'Review', 2),
  ('11111111-1111-1111-1111-111111111111', 'Done', 3);
