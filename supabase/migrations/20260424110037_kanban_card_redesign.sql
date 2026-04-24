-- Kanban Card Redesign schema additions from kanban-card-redesign-prompt.md

-- New board-level tables
create table tags (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  color text not null
);

create table members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  email text,
  color text not null
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete cascade,
  name text not null,
  description text,
  color text not null
);

-- Card extensions (add columns to existing cards table)
alter table cards add column tag_id uuid references tags(id) on delete set null;
alter table cards add column due_date timestamptz;
alter table cards add column watchers uuid[] default '{}';
alter table cards add column deleted_at timestamptz;
alter table cards add column cover_image_url text;

-- Card-level milestones
create table milestones (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  name text not null,
  order_index int not null,
  color text,
  completed boolean default false
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

-- Checklists
create table checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  name text not null,
  order_index int not null
);

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

-- Comments and activity
create table comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz,
  edited boolean default false
);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);
