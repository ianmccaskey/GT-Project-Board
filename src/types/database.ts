export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AssigneeKind = 'member' | 'agent';
export type Assignee = { type: AssigneeKind; id: string } | null;

export interface Tag {
  id: string;
  board_id: string | null;
  name: string;
  color: string;
}

export interface Member {
  id: string;
  board_id: string | null;
  name: string;
  email: string | null;
  color: string;
}

export interface Agent {
  id: string;
  board_id: string | null;
  name: string;
  description: string | null;
  color: string;
}

export interface CardExtensions {
  tag_id: string | null;
  due_date: string | null;
  watchers: string[];
  deleted_at: string | null;
  cover_image_url: string | null;
}

export interface Milestone {
  id: string;
  card_id: string | null;
  name: string;
  order_index: number;
  color: string | null;
  completed: boolean;
}

export interface CardMember {
  card_id: string;
  member_id: string;
}

export interface CardAgent {
  card_id: string;
  agent_id: string;
}

export interface Checklist {
  id: string;
  card_id: string | null;
  name: string;
  order_index: number;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string | null;
  text: string;
  done: boolean;
  order_index: number;
  milestone_id: string | null;
  assignee_type: AssigneeKind | null;
  assignee_id: string | null;
  due_date: string | null;
}

export interface Comment {
  id: string;
  card_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  edited: boolean;
}

export interface ActivityEvent {
  id: string;
  card_id: string | null;
  actor_id: string | null;
  event_type: string;
  payload: Json | null;
  created_at: string;
}
