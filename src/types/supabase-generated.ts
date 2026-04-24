export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      activity_events: {
        Row: {
          id: string;
          card_id: string | null;
          actor_id: string | null;
          event_type: string;
          payload: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          card_id?: string | null;
          actor_id?: string | null;
          event_type: string;
          payload?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          card_id?: string | null;
          actor_id?: string | null;
          event_type?: string;
          payload?: Json | null;
          created_at?: string | null;
        };
      };
      agents: {
        Row: {
          id: string;
          board_id: string | null;
          name: string;
          description: string | null;
          color: string;
        };
        Insert: {
          id?: string;
          board_id?: string | null;
          name: string;
          description?: string | null;
          color: string;
        };
        Update: {
          id?: string;
          board_id?: string | null;
          name?: string;
          description?: string | null;
          color?: string;
        };
      };
      boards: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string | null;
        };
      };
      card_agents: {
        Row: {
          card_id: string;
          agent_id: string;
        };
        Insert: {
          card_id: string;
          agent_id: string;
        };
        Update: {
          card_id?: string;
          agent_id?: string;
        };
      };
      card_members: {
        Row: {
          card_id: string;
          member_id: string;
        };
        Insert: {
          card_id: string;
          member_id: string;
        };
        Update: {
          card_id?: string;
          member_id?: string;
        };
      };
      card_tags: {
        Row: {
          card_id: string;
          tag_id: string;
        };
        Insert: {
          card_id: string;
          tag_id: string;
        };
        Update: {
          card_id?: string;
          tag_id?: string;
        };
      };
      cards: {
        Row: {
          id: string;
          column_id: string | null;
          board_id: string | null;
          title: string;
          description: string | null;
          position: number;
          priority: 'low' | 'medium' | 'high' | 'urgent' | 'none';
          tag_id: string | null;
          due_date: string | null;
          watchers: string[] | null;
          deleted_at: string | null;
          cover_image_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          column_id?: string | null;
          board_id?: string | null;
          title: string;
          description?: string | null;
          position?: number;
          priority?: 'low' | 'medium' | 'high' | 'urgent' | 'none';
          tag_id?: string | null;
          due_date?: string | null;
          watchers?: string[] | null;
          deleted_at?: string | null;
          cover_image_url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          column_id?: string | null;
          board_id?: string | null;
          title?: string;
          description?: string | null;
          position?: number;
          priority?: 'low' | 'medium' | 'high' | 'urgent' | 'none';
          tag_id?: string | null;
          due_date?: string | null;
          watchers?: string[] | null;
          deleted_at?: string | null;
          cover_image_url?: string | null;
          created_at?: string | null;
        };
      };
      checklists: {
        Row: {
          id: string;
          card_id: string | null;
          name: string;
          order_index: number;
        };
        Insert: {
          id?: string;
          card_id?: string | null;
          name: string;
          order_index: number;
        };
        Update: {
          id?: string;
          card_id?: string | null;
          name?: string;
          order_index?: number;
        };
      };
      checklist_items: {
        Row: {
          id: string;
          checklist_id: string | null;
          text: string;
          done: boolean | null;
          order_index: number;
          milestone_id: string | null;
          assignee_type: 'member' | 'agent' | null;
          assignee_id: string | null;
          due_date: string | null;
        };
        Insert: {
          id?: string;
          checklist_id?: string | null;
          text: string;
          done?: boolean | null;
          order_index: number;
          milestone_id?: string | null;
          assignee_type?: 'member' | 'agent' | null;
          assignee_id?: string | null;
          due_date?: string | null;
        };
        Update: {
          id?: string;
          checklist_id?: string | null;
          text?: string;
          done?: boolean | null;
          order_index?: number;
          milestone_id?: string | null;
          assignee_type?: 'member' | 'agent' | null;
          assignee_id?: string | null;
          due_date?: string | null;
        };
      };
      columns: {
        Row: {
          id: string;
          board_id: string | null;
          name: string;
          position: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          board_id?: string | null;
          name: string;
          position?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          board_id?: string | null;
          name?: string;
          position?: number;
          created_at?: string | null;
        };
      };
      comments: {
        Row: {
          id: string;
          card_id: string | null;
          author_id: string;
          body: string;
          created_at: string | null;
          updated_at: string | null;
          edited: boolean | null;
        };
        Insert: {
          id?: string;
          card_id?: string | null;
          author_id: string;
          body: string;
          created_at?: string | null;
          updated_at?: string | null;
          edited?: boolean | null;
        };
        Update: {
          id?: string;
          card_id?: string | null;
          author_id?: string;
          body?: string;
          created_at?: string | null;
          updated_at?: string | null;
          edited?: boolean | null;
        };
      };
      members: {
        Row: {
          id: string;
          board_id: string | null;
          name: string;
          email: string | null;
          color: string;
        };
        Insert: {
          id?: string;
          board_id?: string | null;
          name: string;
          email?: string | null;
          color: string;
        };
        Update: {
          id?: string;
          board_id?: string | null;
          name?: string;
          email?: string | null;
          color?: string;
        };
      };
      milestones: {
        Row: {
          id: string;
          card_id: string | null;
          name: string;
          order_index: number;
          color: string | null;
          completed: boolean | null;
        };
        Insert: {
          id?: string;
          card_id?: string | null;
          name: string;
          order_index: number;
          color?: string | null;
          completed?: boolean | null;
        };
        Update: {
          id?: string;
          card_id?: string | null;
          name?: string;
          order_index?: number;
          color?: string | null;
          completed?: boolean | null;
        };
      };
      tags: {
        Row: {
          id: string;
          board_id: string | null;
          name: string;
          color: string;
        };
        Insert: {
          id?: string;
          board_id?: string | null;
          name: string;
          color: string;
        };
        Update: {
          id?: string;
          board_id?: string | null;
          name?: string;
          color?: string;
        };
      };
    };
  };
}
