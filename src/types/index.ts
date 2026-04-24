import type { Agent, CardExtensions, Comment, Member, Tag } from './database';

export type {
  ActivityEvent,
  Agent,
  Assignee,
  AssigneeKind,
  CardAgent,
  CardExtensions,
  CardMember,
  Checklist,
  ChecklistItem,
  ChecklistItemWithChecklist,
  Comment,
  Member,
  Milestone,
  Tag,
} from './database';

export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'none';
export type ViewMode = 'board' | 'list' | 'calendar';

export interface Board {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Card extends CardExtensions {
  id: string;
  column_id: string;
  board_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: Priority;
  created_at: string;
  tags: Tag[];
  members: Member[];
  agents: Agent[];
  comments: Comment[];
}
