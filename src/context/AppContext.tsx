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
  error: string | null;
}

interface AppContextType extends AppState {
  setCurrentBoard: (board: Board | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFilterTag: (tagId: string | null) => void;
  setFilterPriority: (priority: Priority | null) => void;
  setFilterDue: (filter: 'all' | 'overdue' | 'today' | 'week') => void;
  setError: (error: string | null) => void;
  clearError: () => void;
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
    error: null,
  });

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const fetchBoards = async () => {
    const { data, error } = await supabase.from('boards').select('*').order('created_at');
    if (error) { console.error('fetchBoards error:', error); throw error; }
    return data as Board[];
  };

  const fetchColumns = async (boardId: string) => {
    const { data, error } = await supabase.from('columns').select('*').eq('board_id', boardId).order('position');
    if (error) { console.error('fetchColumns error:', error); throw error; }
    return data as Column[];
  };

  const fetchCards = async (boardId: string) => {
    const { data: cards, error } = await supabase.from('cards').select('*').eq('board_id', boardId).order('position');
    if (error) { console.error('fetchCards error:', error); throw error; }

    // Fetch tags and comments for all cards
    const cardIds = (cards as Card[]).map(c => c.id);

    // Short-circuit when no cards to avoid .in([]) queries
    let cardTags: any[] = [];
    let tags: Tag[] = [];
    let comments: Comment[] = [];

    if (cardIds.length > 0) {
      const [ctResult, tResult, cResult] = await Promise.all([
        supabase.from('card_tags').select('*').in('card_id', cardIds),
        supabase.from('tags').select('*').eq('board_id', boardId),
        supabase.from('comments').select('*').in('card_id', cardIds),
      ]);
      if (ctResult.error) { console.error('fetchCardTags error:', ctResult.error); throw ctResult.error; }
      if (tResult.error) { console.error('fetchTags error:', tResult.error); throw tResult.error; }
      if (cResult.error) { console.error('fetchComments error:', cResult.error); throw cResult.error; }
      cardTags = ctResult.data || [];
      tags = (tResult.data as Tag[]) || [];
      comments = (cResult.data as Comment[]) || [];
    }

    const tagMap: Record<string, Tag[]> = {};
    cardTags.forEach((ct: any) => {
      if (!tagMap[ct.card_id]) tagMap[ct.card_id] = [];
      const tag = tags.find((t: Tag) => t.id === ct.tag_id);
      if (tag) tagMap[ct.card_id].push(tag);
    });

    const commentMap: Record<string, Comment[]> = {};
    comments.forEach((c: Comment) => {
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
    const { data, error } = await supabase.from('tags').select('*').eq('board_id', boardId);
    if (error) { console.error('fetchTags error:', error); throw error; }
    return data as Tag[];
  };

  const refreshData = useCallback(async () => {
    try {
      const boards = await fetchBoards();
      let columns: Column[] = [];
      let cards: Card[] = [];
      let tags: Tag[] = [];

      const currentBoard = state.currentBoard || boards?.[0] || null;
      if (currentBoard) {
        [columns, cards, tags] = await Promise.all([
          fetchColumns(currentBoard.id),
          fetchCards(currentBoard.id),
          fetchTags(currentBoard.id),
        ]);
      }

      setState(prev => ({ ...prev, boards, currentBoard, columns, cards, tags, error: null }));
    } catch (err: any) {
      console.error('refreshData error:', err);
      setError(err.message || 'Failed to refresh data');
    }
  }, [state.currentBoard, setError]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }).catch((err: any) => {
      console.error('Board data fetch error:', err);
      setError(err.message || 'Failed to fetch board data');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentBoard?.id, setError]);

  const setViewMode = useCallback((mode: ViewMode) => setState(prev => ({ ...prev, viewMode: mode })), []);
  const setFilterTag = useCallback((tagId: string | null) => setState(prev => ({ ...prev, filterTag: tagId })), []);
  const setFilterPriority = useCallback((priority: Priority | null) => setState(prev => ({ ...prev, filterPriority: priority })), []);
  const setFilterDue = useCallback((filter: 'all' | 'overdue' | 'today' | 'week') => setState(prev => ({ ...prev, filterDue: filter })), []);

  const createBoard = async (name: string) => {
    try {
      const { data, error } = await supabase.from('boards').insert({ name }).select().single();
      if (error) { console.error('createBoard error:', error); setError(error.message); return; }
      if (data) {
        const newBoard = data as Board;
        const { error: colError } = await supabase.from('columns').insert([
          { board_id: newBoard.id, name: 'Backlog', position: 0 },
          { board_id: newBoard.id, name: 'In Progress', position: 1 },
          { board_id: newBoard.id, name: 'Review', position: 2 },
          { board_id: newBoard.id, name: 'Done', position: 3 },
        ]);
        if (colError) { console.error('createBoard columns error:', colError); setError(colError.message); return; }
        await refreshData();
        setCurrentBoard(newBoard);
      }
    } catch (err: any) {
      console.error('createBoard error:', err);
      setError(err.message || 'Failed to create board');
    }
  };

  const deleteBoard = async (id: string) => {
    try {
      const { error } = await supabase.from('boards').delete().eq('id', id);
      if (error) { console.error('deleteBoard error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('deleteBoard error:', err);
      setError(err.message || 'Failed to delete board');
    }
  };

  const createColumn = async (name: string) => {
    if (!state.currentBoard) return;
    try {
      const maxPos = Math.max(0, ...state.columns.map(c => c.position));
      const { error } = await supabase.from('columns').insert({ board_id: state.currentBoard.id, name, position: maxPos + 1 });
      if (error) { console.error('createColumn error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('createColumn error:', err);
      setError(err.message || 'Failed to create column');
    }
  };

  const updateColumn = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('columns').update({ name }).eq('id', id);
      if (error) { console.error('updateColumn error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('updateColumn error:', err);
      setError(err.message || 'Failed to update column');
    }
  };

  const deleteColumn = async (id: string) => {
    try {
      const { error } = await supabase.from('columns').delete().eq('id', id);
      if (error) { console.error('deleteColumn error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('deleteColumn error:', err);
      setError(err.message || 'Failed to delete column');
    }
  };

  const reorderColumns = async (ids: string[]) => {
    try {
      const results = await Promise.all(ids.map((id, i) => supabase.from('columns').update({ position: i }).eq('id', id)));
      const firstError = results.find(r => r.error)?.error;
      if (firstError) { console.error('reorderColumns error:', firstError); setError(firstError.message || 'Failed to reorder columns'); return; }
      await refreshData();
    } catch (err: any) {
      console.error('reorderColumns error:', err);
      setError(err.message || 'Failed to reorder columns');
    }
  };

  const createCard = async (columnId: string, title: string) => {
    if (!state.currentBoard) return;
    try {
      const maxPos = Math.max(0, ...state.cards.filter(c => c.column_id === columnId).map(c => c.position));
      const { error } = await supabase.from('cards').insert({
        column_id: columnId, board_id: state.currentBoard.id, title, position: maxPos + 1, priority: 'medium',
      });
      if (error) { console.error('createCard error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('createCard error:', err);
      setError(err.message || 'Failed to create card');
    }
  };

  const updateCard = async (card: Partial<Card> & { id: string }) => {
    try {
      const { tags, comments: _comments, ...rest } = card;
      const { error } = await supabase.from('cards').update(rest).eq('id', card.id);
      if (error) { console.error('updateCard error:', error); setError(error.message); return; }

      if (tags) {
        const { error: deleteError } = await supabase.from('card_tags').delete().eq('card_id', card.id);
        if (deleteError) { console.error('updateCard deleteTags error:', deleteError); setError(deleteError.message); return; }
        if (tags.length > 0) {
          const { error: insertError } = await supabase.from('card_tags').insert(tags.map(t => ({ card_id: card.id, tag_id: t.id })));
          if (insertError) { console.error('updateCard insertTags error:', insertError); setError(insertError.message); return; }
        }
      }
      await refreshData();
    } catch (err: any) {
      console.error('updateCard error:', err);
      setError(err.message || 'Failed to update card');
    }
  };

  const deleteCard = async (id: string) => {
    try {
      const { error } = await supabase.from('cards').delete().eq('id', id);
      if (error) { console.error('deleteCard error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('deleteCard error:', err);
      setError(err.message || 'Failed to delete card');
    }
  };

  const moveCard = async (cardId: string, toColumnId: string, position: number) => {
    try {
      const { error } = await supabase.from('cards').update({ column_id: toColumnId, position }).eq('id', cardId);
      if (error) { console.error('moveCard error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('moveCard error:', err);
      setError(err.message || 'Failed to move card');
    }
  };

  const reorderCards = async (columnId: string, cardIds: string[]) => {
    try {
      const results = await Promise.all(cardIds.map((id, i) => supabase.from('cards').update({ column_id: columnId, position: i }).eq('id', id)));
      const firstError = results.find(r => r.error)?.error;
      if (firstError) { console.error('reorderCards error:', firstError); setError(firstError.message || 'Failed to reorder cards'); return; }
      await refreshData();
    } catch (err: any) {
      console.error('reorderCards error:', err);
      setError(err.message || 'Failed to reorder cards');
    }
  };

  const createTag = async (boardId: string, name: string, color: string) => {
    try {
      const { error } = await supabase.from('tags').insert({ board_id: boardId, name, color });
      if (error) { console.error('createTag error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('createTag error:', err);
      setError(err.message || 'Failed to create tag');
    }
  };

  const deleteTag = async (id: string) => {
    try {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) { console.error('deleteTag error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('deleteTag error:', err);
      setError(err.message || 'Failed to delete tag');
    }
  };

  const addComment = async (cardId: string, content: string) => {
    try {
      const { error } = await supabase.from('comments').insert({ card_id: cardId, content });
      if (error) { console.error('addComment error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('addComment error:', err);
      setError(err.message || 'Failed to add comment');
    }
  };

  return (
    <AppContext.Provider value={{ ...state, setCurrentBoard, setViewMode, setFilterTag, setFilterPriority, setFilterDue, setError, clearError, createBoard, deleteBoard, createColumn, updateColumn, deleteColumn, reorderColumns, createCard, updateCard, deleteCard, moveCard, reorderCards, createTag, deleteTag, addComment, refreshData }}>
      {children}
    </AppContext.Provider>
  );
}
