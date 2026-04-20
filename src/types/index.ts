export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ViewMode = 'board' | 'list' | 'calendar';

export interface Board {
  id: string;
  name: string;
  created_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface Card {
  id: string;
  column_id: string;
  board_id: string;
  title: string;
  description: string | null;
  position: number;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  tags: Tag[];
  comments: Comment[];
}

export interface Comment {
  id: string;
  card_id: string;
  content: string;
  created_at: string;
}
