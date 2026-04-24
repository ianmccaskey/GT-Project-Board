# Kanban Card Redesign + Side Panel

## Context

Kanban board app built with:

**Frontend**
- Next.js 15 (React 18)
- Tailwind CSS v4
- @dnd-kit (core + sortable + utilities) for drag-and-drop
- lucide-react for icons
- date-fns for date formatting/manipulation

**Backend / Database**
- Supabase (PostgreSQL via `@supabase/supabase-js`)

**Existing features to preserve**
- Column drag-and-drop (@dnd-kit)
- Column CRUD
- Current priority field
- Current description field
- Current title field
- All existing routes and data

## Goal

Redesign the card detail view into a two-pane layout: a main content pane on the left and a "Comments and activity" side panel on the right. Replace the current "Add Tag" row with a richer set of add-buttons, and remove the bottom-anchored comments section (move it into the right side panel).

## Layout

Card detail is a **URL-routed modal**: opening card `X` navigates to `/board/:boardId/card/:cardId`; closing returns to the board. Use Next.js App Router parallel/intercepting routes so the modal has a shareable URL but the board stays behind it. Esc closes. Clicking the backdrop closes. On mobile (<768px) the side panel stacks below the main pane.

**All card changes auto-save** — no explicit save button. Debounce text fields (300ms) and write on blur; write immediately for discrete changes (checkbox toggle, assignee change, date change, priority change). Show a subtle "Saved" indicator in the modal header after each successful write.

```
┌─────────────────────────────────────────────────────────┐
│ [cover/attachments] [watch] [Saved ✓] [more ⋯] [close ✕]│
├──────────────────────────────┬──────────────────────────┤
│ ○ Title (inline editable)    │ 💬 Comments and activity │
│                              │ [All | Comments only]    │
│ [Add buttons row]            │                          │
│                              │ [Write a comment...]     │
│ Due date                     │                          │
│ [date/time picker or Open]   │ ── interleaved stream ── │
│                              │ • User: comment text     │
│ Project Tag                  │ • System: action · time  │
│ [single tag chip]            │ • ...                    │
│                              │                          │
│ Members / Agents             │                          │
│ [avatars]                    │                          │
│                              │                          │
│ Priority                     │                          │
│ [Low / Medium / High / None] │                          │
│                              │                          │
│ Description                  │                          │
│ [markdown text, Edit toggle] │                          │
│                              │                          │
│ Milestones                   │                          │
│ [timeline graphic + list]    │                          │
│                              │                          │
│ Checklist                    │                          │
│ [grouped by milestone]       │                          │
└──────────────────────────────┴──────────────────────────┘
```

## Add-buttons row

Below the title, a row of outlined buttons. Clicking each reveals/focuses that section if it doesn't exist yet, or scrolls to it if it does:
- **Add Project Tag**
- **Add Due Date**
- **Add Members**
- **Add Agent**
- **Add Milestones**
- **Add Checklist**

## Feature specs

### Project Tag (single, category-style)

- **Exactly one tag per card** (acts as a category, not multiple labels).
- Tags live in a **global board-level registry**: `{ id, name, color }`.
- Color picker per tag — 8-color palette.
- Global tag management UI accessible from board settings (rename and color changes cascade; deleting a tag unassigns it from all cards).
- Card-level picker: searchable list + "Create new" inline.
- Selecting a new tag replaces the existing one.
- **Filter bar above Kanban columns**: **multi-select** tag filter. Selecting multiple tags shows cards matching ANY selected tag (OR logic). **No filter = show all cards** (default state). Include a "Clear" link when any filters are active.

### Due Date

- **Date + time** picker.
- Time defaults to **12:00 PM (noon)** when a date is first picked.
- "Open" is the default state (no due date) for new cards. A "Clear" button on the picker returns to Open.
- Stored as ISO timestamp in user's local timezone.
- **Visual cue on the card tile in the column**:
  - Red badge if overdue (due date is in the past and card isn't complete).
  - Amber badge if due within 48 hours.
  - Neutral badge otherwise.
- Same color treatment on the due date field in the card modal.

### Members

- Board has a **member registry** — the user creates/manages members manually from board settings. Each member: `{ id, name, email?, color }` with color auto-assigned on creation (user can edit).
- Card member picker selects from the registry (multi-select).
- Avatars = initials on colored circle.
- Members assigned to a card can be assigned to checklist items on that card.
- **Removing a member from the board does NOT delete checklist items** — it just leaves those items unassigned (`assignee: null`). Log this in activity for affected cards.

### Agents

- Treated **exactly like members**, but labeled as agents. `{ id, name, description?, color }`.
- Managed from board settings alongside members (separate "Agents" section).
- Visually distinct:
  - **Robot icon** (lucide `Bot`) instead of initials.
  - Different avatar border (dashed or accent color) to distinguish from humans at a glance.
  - "AI" text badge overlay on the avatar corner.
- Can be assigned to checklist items exactly like members.
- Card shows a **dedicated "Agents" area** alongside "Members" in the card modal, so it's clear which agents are tied to the card.
- Unified data model for assignment: `assignee: { type: 'member' | 'agent'; id: string } | null`.

### Milestones (card-level)

- Milestones are **card-level**, not board-level. Each card has its own ordered list.
- Each milestone: `{ id, name, order, color?, completed: boolean }`.
- **No start/end dates required** — milestones are sequential progress markers, not scheduled events.
- Optional color per milestone.
- **Small inline timeline graphic** above the milestone list showing the milestones in series (horizontal dots/pills connected by a line, completed ones filled in, current one highlighted). This acts as a progress indicator for the card.
- Milestone completion is either manual (user checks it off) or auto-derived from checklist items assigned to that milestone (all done → milestone done). **Default to auto-derived** when the milestone has checklist items linked to it; otherwise manual.
- Drag to reorder. Add inline. Rename inline.

### Checklist

- Card can have multiple checklists, each with a name.
- Each item: `{ id, text, done, assignee?, milestoneId?, dueDate? }`.
- **Grouped by milestone** within the checklist view:
  - The **current milestone** (first incomplete milestone) is **expanded** by default, showing all its items.
  - All other milestones render as a **compact one-line summary row**: `[milestone name] [progress: 3/7] [▸ expand]`.
  - Items not associated with any milestone render in their own "Unassigned" group, expanded.
- Compact item row: checkbox · text · tiny milestone pill (if set) · tiny assignee avatar (member or agent) · overflow menu.
- Drag to reorder items within a milestone group (via @dnd-kit/sortable).
- Enter adds the next item in the same group. Backspace on empty deletes.
- Overall card progress bar = % of all items done across all checklists.

### Description

- Keep existing markdown behavior. Edit button toggles edit mode. Auto-save on blur.

### Priority

- Keep existing values: **Low / Medium / High / None**.
- **Visual treatment**:
  - In the card modal: colored pill/badge on the priority selector.
  - **On the card tile in the column: colored left border** — green (Low), yellow (Medium), red (High), none (None).

### Comments & Activity side panel

- Title: **"Comments and activity"**.
- **Filter toggle** at the top of the panel: `[All] [Comments only]` — toggles whether system events are shown alongside comments.
- Comment input at top of stream: textarea, **Ctrl/Cmd+Enter submits**.
- **Combined stream**, newest first, interleaving user comments and system events.
- Each comment: author avatar + name, relative timestamp (hover = absolute), **Edit** and **Delete** on your own comments. Edited comments show "(edited)".
- **System events to log**:
  - Card created
  - Due date set/changed/cleared
  - Member added/removed
  - Agent added/removed
  - Milestone added (and completed)
  - Checklist item added / checked / unchecked / deleted
  - Priority changed
  - Card moved between columns
- System events render as a single line with a small icon and muted styling.

## Card modal header

- Cover image / attachment icon — stub for now; show "Coming soon" tooltip.
- Watch/subscribe toggle — stores a boolean per user (for later notifications).
- "Saved ✓" indicator (fades in/out on each save).
- Overflow menu (⋯): Archive card, **Delete card (with confirmation dialog + undo toast)**, Copy link to card.
- Close ✕ (also bound to Esc).

## Delete card flow

1. User clicks Delete in overflow menu.
2. Confirmation dialog: "Delete this card? This can be undone."
3. On confirm: card is removed from the board (soft-delete in DB: `deleted_at` timestamp).
4. **Undo toast** appears bottom-center for 10 seconds: "Card deleted. [Undo]".
5. Clicking Undo restores the card (clear `deleted_at`).
6. After 10 seconds, the delete becomes permanent via a cleanup job (or keep the soft-delete indefinitely — call this out in the README).

## Keyboard shortcuts

- **Esc** — closes modal.
- **Ctrl/Cmd+Enter** — submits comment (when focus is in the comment input).

## Data model (Supabase / Postgres)

Additive, backwards-compatible changes. Old cards load fine with new columns null/default.

```sql
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
  assignee_id uuid,  -- references members.id or agents.id based on assignee_type
  due_date timestamptz
);

-- Comments and activity
create table comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  author_id uuid not null,           -- references the authenticated user
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz,
  edited boolean default false
);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  actor_id uuid,                     -- user who triggered; null for system
  event_type text not null,          -- 'card_created', 'due_date_set', etc.
  payload jsonb,                     -- event-specific details
  created_at timestamptz default now()
);
```

TypeScript types should mirror these shapes and live in `types/database.ts` (generated via `supabase gen types` if possible).

## Non-goals (do not build)

- Real-time collaboration / websockets (can use Supabase Realtime later, but not required now).
- Actual AI agent execution — agents are labels only.
- File attachments — header icon is a stub with "Coming soon" tooltip.
- Email notifications for watchers — store the subscription only.
- Tag-based grouping or reordering beyond the filter bar.

## Non-breaking requirements

- Existing column drag-and-drop must continue to work.
- Existing title, description, priority editing must continue to work.
- Existing routes, data, and column CRUD must not regress.
- All new card fields must default gracefully for pre-existing cards.

## Polish checklist

- Esc closes modal.
- Ctrl/Cmd+Enter submits comment.
- Optimistic UI updates for all mutations; reconcile on response.
- Undo toast on destructive actions (delete card).
- Mobile: side panel stacks below main pane at <768px.
- Empty states for each section (e.g. "No members yet. Add Members above.").
- Loading skeletons for async sections.
- "Saved ✓" indicator after auto-saves.
- Overdue/due-soon visual cues on card tiles in columns.
- Priority left-border color on card tiles in columns.

## Suggested commit order (small, reviewable slices)

1. URL-routed card modal + close/Esc + Saved indicator plumbing.
2. Supabase schema migrations + generated types.
3. Board settings: Tags registry (CRUD + color picker).
4. Board settings: Members registry (CRUD + initials/color avatars).
5. Board settings: Agents registry (CRUD + robot icon / AI badge).
6. Card: Project Tag picker + column filter bar (multi-select).
7. Card: Due Date picker (defaults to noon) + overdue/due-soon tile cues.
8. Card: Members + Agents sections + assignment.
9. Card: Priority visual treatment (modal + column tile left border).
10. Card: Milestones (card-level, inline timeline graphic, reorder, auto/manual completion).
11. Card: Checklists grouped by milestone (compact summaries + expanded current).
12. Card: Comments & Activity side panel (filter toggle, edit/delete comments, event logging).
13. Card: Delete flow with confirmation + undo toast.
14. Final polish pass: mobile stack, empty states, skeletons, accessibility.

## Deliverables

- Implementation organized per the commit order above.
- README update describing: new data model, URL-routed modal, auto-save behavior, and any soft-delete cleanup policy chosen.
- No new heavy dependencies — reuse the stack listed in Context. If a small utility is needed (e.g. a date picker), use a lightweight headless option or build it on top of date-fns + Tailwind.
