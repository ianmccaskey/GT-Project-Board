'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Board, Column, Card, Tag, Comment, Priority, ViewMode } from '@/types';

interface AppState {
  boards: Board[];
  currentBoard: Board | null;
  columns: Column[];
  cards: Card[];
  tags: Tag[];
  viewMode: ViewMode;
  filterTag: string | null;
  filterPriority: Priority | null;
  filterDue: 'all' | 'overdue' | 'today' | 'week';
}

interface AppContextType extends AppState {
  setCurrentBoard: (board: Board | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFilterTag: (tagId: string | null) => void;
  setFilterPriority: (priority: Priority | null) => void;
  setFilterDue: (filter: 'all' | 'overdue' | 'today' | 'week') => void;
  createBoard: (name: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  createColumn: (name: string) => Promise<void>;
  updateColumn: (id: string, name: string) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  reorderColumns: (ids: string[]) => Promise<void>;
  createCard: (columnId: string, title: string) => Promise<void>;
  updateCard: (card: Partial<Card> & { id: string }) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (cardId: string, toColumnId: string, position: number) => Promise<void>;
  reorderCards: (columnId: string, cardIds: string[]) => Promise<void>;
  createTag: (boardId: string, name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  addComment: (cardId: string, content: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    boards: [],
    currentBoard: null,
    columns: [],
    cards: [],
    tags: [],
    viewMode: 'board',
    filterTag: null,
    filterPriority: null,
    filterDue: 'all',
  });

  const fetchBoards = async () => {
    const { data } = await supabase.from('boards').select('*').order('created_at');
    return data as Board[];
  };

  const fetchColumns = async (boardId: string) => {
    const { data } = await supabase.from('columns').select('*').eq('board_id', boardId).order('position');
    return data as Column[];
  };

  const fetchCards = async (boardId: string) => {
    const { data: cards } = await supabase.from('cards').select('*').eq('board_id', boardId).order('position');

    // Fetch tags and comments for all cards
    const cardIds = (cards as Card[]).map(c => c.id);
    const { data: cardTags } = await supabase.from('card_tags').select('*').in('card_id', cardIds);
    const { data: tags } = await supabase.from('tags').select('*').eq('board_id', boardId);
    const { data: comments } = await supabase.from('comments').select('*').in('card_id', cardIds);

    const tagMap: Record<string, Tag[]> = {};
    (cardTags || []).forEach((ct: any) => {
      if (!tagMap[ct.card_id]) tagMap[ct.card_id] = [];
      const tag = (tags || []).find((t: Tag) => t.id === ct.tag_id);
      if (tag) tagMap[ct.card_id].push(tag);
    });

    const commentMap: Record<string, Comment[]> = {};
    (comments || []).forEach((c: Comment) => {
      if (!commentMap[c.card_id]) commentMap[c.card_id] = [];
      commentMap[c.card_id].push(c);
    });

    return (cards as Card[]).map(card => ({
      ...card,
      tags: tagMap[card.id] || [],
      comments: commentMap[card.id] || [],
    }));
  };

  const fetchTags = async (boardId: string) => {
    const { data } = await supabase.from('tags').select('*').eq('board_id', boardId);
    return data as Tag[];
  };

  const refreshData = useCallback(async () => {
    const boards = await fetchBoards();
    let columns: Column[] = [];
    let cards: Card[] = [];
    let tags: Tag[] = [];

    const currentBoard = state.currentBoard || boards[0] || null;
    if (currentBoard) {
      [columns, cards, tags] = await Promise.all([
        fetchColumns(currentBoard.id),
        fetchCards(currentBoard.id),
        fetchTags(currentBoard.id),
      ]);
    }

    setState(prev => ({ ...prev, boards, currentBoard, columns, cards, tags }));
  }, [state.currentBoard]);

  useEffect(() => { refreshData(); }, []);

  const setCurrentBoard = useCallback((board: Board | null) => {
    setState(prev => ({ ...prev, currentBoard: board }));
  }, []);

  useEffect(() => {
    if (!state.currentBoard) return;
    Promise.all([
      fetchColumns(state.currentBoard.id),
      fetchCards(state.currentBoard.id),
      fetchTags(state.currentBoard.id),
    ]).then(([columns, cards, tags]) => {
      setState(prev => ({ ...prev, columns, cards, tags }));
    });
  }, [state.currentBoard?.id]);

  const setViewMode = useCallback((mode: ViewMode) => setState(prev => ({ ...prev, viewMode: mode })), []);
  const setFilterTag = useCallback((tagId: string | null) => setState(prev => ({ ...prev, filterTag: tagId })), []);
  const setFilterPriority = useCallback((priority: Priority | null) => setState(prev => ({ ...prev, filterPriority: priority })), []);
  const setFilterDue = useCallback((filter: 'all' | 'overdue' | 'today' | 'week') => setState(prev => ({ ...prev, filterDue: filter })), []);

  const createBoard = async (name: string) => {
    const { data } = await supabase.from('boards').insert({ name }).select().single();
    if (data) {
      const newBoard = data as Board;
      // Create default columns
      await supabase.from('columns').insert([
        { board_id: newBoard.id, name: 'Backlog', position: 0 },
        { board_id: newBoard.id, name: 'In Progress', position: 1 },
        { board_id: newBoard.id, name: 'Review', position: 2 },
        { board_id: newBoard.id, name: 'Done', position: 3 },
      ]);
      await refreshData();
      setCurrentBoard(newBoard);
    }
  };

  const deleteBoard = async (id: string) => {
    await supabase.from('boards').delete().eq('id', id);
    await refreshData();
  };

  const createColumn = async (name: string) => {
    if (!state.currentBoard) return;
    const maxPos = Math.max(0, ...state.columns.map(c => c.position));
    await supabase.from('columns').insert({ board_id: state.currentBoard.id, name, position: maxPos + 1 });
    await refreshData();
  };

  const updateColumn = async (id: string, name: string) => {
    await supabase.from('columns').update({ name }).eq('id', id);
    await refreshData();
  };

  const deleteColumn = async (id: string) => {
    await supabase.from('columns').delete().eq('id', id);
    await refreshData();
  };

  const reorderColumns = async (ids: string[]) => {
    await Promise.all(ids.map((id, i) => supabase.from('columns').update({ position: i }).eq('id', id)));
    await refreshData();
  };

  const createCard = async (columnId: string, title: string) => {
    if (!state.currentBoard) return;
    const maxPos = Math.max(0, ...state.cards.filter(c => c.column_id === columnId).map(c => c.position));
    await supabase.from('cards').insert({
      column_id: columnId, board_id: state.currentBoard.id, title, position: maxPos + 1, priority: 'medium',
    });
    await refreshData();
  };

  const updateCard = async (card: Partial<Card> & { id: string }) => {
    const { tags, comments, ...rest } = card;
    await supabase.from('cards').update(rest).eq('id', card.id);

    if (tags) {
      await supabase.from('card_tags').delete().eq('card_id', card.id);
      if (tags.length > 0) {
        await supabase.from('card_tags').insert(tags.map(t => ({ card_id: card.id, tag_id: t.id })));
      }
    }
    await refreshData();
  };

  const deleteCard = async (id: string) => {
    await supabase.from('cards').delete().eq('id', id);
    await refreshData();
  };

  const moveCard = async (cardId: string, toColumnId: string, position: number) => {
    await supabase.from('cards').update({ column_id: toColumnId, position }).eq('id', cardId);
    await refreshData();
  };

  const reorderCards = async (columnId: string, cardIds: string[]) => {
    await Promise.all(cardIds.map((id, i) => supabase.from('cards').update({ column_id: columnId, position: i }).eq('id', id)));
    await refreshData();
  };

  const createTag = async (boardId: string, name: string, color: string) => {
    await supabase.from('tags').insert({ board_id: boardId, name, color });
    await refreshData();
  };

  const deleteTag = async (id: string) => {
    await supabase.from('tags').delete().eq('id', id);
    await refreshData();
  };

  const addComment = async (cardId: string, content: string) => {
    await supabase.from('comments').insert({ card_id: cardId, content });
    await refreshData();
  };

  return (
    <AppContext.Provider value={{ ...state, setCurrentBoard, setViewMode, setFilterTag, setFilterPriority, setFilterDue, createBoard, deleteBoard, createColumn, updateColumn, deleteColumn, reorderColumns, createCard, updateCard, deleteCard, moveCard, reorderCards, createTag, deleteTag, addComment, refreshData }}>
      {children}
    </AppContext.Provider>
  );
}
