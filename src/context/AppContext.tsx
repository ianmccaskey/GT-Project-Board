'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Board, Column, Card, Tag, Comment, Priority, ViewMode } from '@/types';

const SESSION_STORAGE_KEY = 'kanban.supabase.session-token';

interface AppState {
  session: Session | null;
  user: User | null;
  userName: string | null;
  authLoading: boolean;
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
  createTag: (boardId: string, name: string, color: string) => Promise<Tag | null>;
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
    session: null,
    user: null,
    userName: null,
    authLoading: true,
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
  const currentBoardRef = useRef<Board | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  const skipNextBoardLoadRef = useRef(true);
  const boardEffectCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    currentBoardRef.current = state.currentBoard;
    userIdRef.current = state.user?.id;
  }, [state.currentBoard, state.user?.id]);

  const getUserName = useCallback((user: User | null) => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase();
    if (email === 'ian@gigatechproducts.com') return 'Ian';
    if (email === 'todd@gigatechproducts.com') return 'Todd';

    const [localPart] = email.split('@');
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }, []);

  const applySession = useCallback((session: Session | null) => {
    if (typeof window !== 'undefined') {
      if (session?.access_token) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, session.access_token);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    setState(prev => ({
      ...prev,
      session,
      user: session?.user ?? null,
      userName: getUserName(session?.user ?? null),
      authLoading: false,
    }));
  }, [getUserName]);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const fetchBoards = useCallback(async (ownerId: string) => {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at');
    if (error) { console.error('fetchBoards error:', error); throw error; }
    return data as Board[];
  }, []);

  const fetchColumns = useCallback(async (boardId: string) => {
    const { data, error } = await supabase.from('columns').select('*').eq('board_id', boardId).order('position');
    if (error) { console.error('fetchColumns error:', error); throw error; }
    return data as Column[];
  }, []);

  const fetchCards = useCallback(async (boardId: string) => {
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
  }, []);

  const fetchTags = useCallback(async (boardId: string) => {
    const { data, error } = await supabase.from('tags').select('*').eq('board_id', boardId);
    if (error) { console.error('fetchTags error:', error); throw error; }
    return data as Tag[];
  }, []);

  const refreshData = useCallback(async (preferredBoard: Board | null = currentBoardRef.current, ownerId = userIdRef.current) => {
    if (!ownerId) {
      skipNextBoardLoadRef.current = true;
      setState(prev => ({
        ...prev,
        boards: [],
        currentBoard: null,
        columns: [],
        cards: [],
        tags: [],
        error: null,
      }));
      return;
    }

    try {
      const boards = await fetchBoards(ownerId);
      let columns: Column[] = [];
      let cards: Card[] = [];
      let tags: Tag[] = [];

      const currentBoard = preferredBoard
        ? boards.find(board => board.id === preferredBoard.id) || boards[0] || null
        : boards[0] || null;
      if (currentBoard) {
        [columns, cards, tags] = await Promise.all([
          fetchColumns(currentBoard.id),
          fetchCards(currentBoard.id),
          fetchTags(currentBoard.id),
        ]);
      }

      skipNextBoardLoadRef.current = true;
      setState(prev => ({ ...prev, boards, currentBoard, columns, cards, tags, error: null }));
    } catch (err: any) {
      console.error('refreshData error:', err);
      setError(err.message || 'Failed to refresh data');
    }
  }, [fetchBoards, fetchCards, fetchColumns, fetchTags, setError]);

  const loadBoardData = useCallback(async (board: Board | null) => {
    if (!board) {
      setState(prev => ({ ...prev, columns: [], cards: [], tags: [], error: null }));
      return;
    }

    try {
      const [columns, cards, tags] = await Promise.all([
        fetchColumns(board.id),
        fetchCards(board.id),
        fetchTags(board.id),
      ]);

      setState(prev => {
        if (prev.currentBoard?.id !== board.id) {
          return prev;
        }

        return { ...prev, columns, cards, tags, error: null };
      });
    } catch (err: any) {
      console.error('loadBoardData error:', err);
      setError(err.message || 'Failed to load board data');
    }
  }, [fetchCards, fetchColumns, fetchTags, setError]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('getSession error:', error);
        if (mounted) {
          setError(error.message);
          setState(prev => ({ ...prev, authLoading: false }));
        }
        return;
      }

      if (mounted) {
        applySession(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
      setState(prev => ({
        ...prev,
        boards: session ? prev.boards : [],
        currentBoard: session ? prev.currentBoard : null,
        columns: session ? prev.columns : [],
        cards: session ? prev.cards : [],
        tags: session ? prev.tags : [],
        error: null,
      }));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession, setError]);

  useEffect(() => {
    if (state.authLoading) return;
    if (!state.user) {
      void refreshData(null, undefined);
      return;
    }

    void refreshData(currentBoardRef.current, state.user.id);
  }, [refreshData, state.authLoading, state.user]);

  useEffect(() => {
    if (state.authLoading || !state.user || !state.currentBoard) return;

    const boardId = state.currentBoard.id;
    boardEffectCountsRef.current[boardId] = (boardEffectCountsRef.current[boardId] || 0) + 1;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AppProvider] board data effect', {
        boardId,
        runCount: boardEffectCountsRef.current[boardId],
      });
    }

    if (skipNextBoardLoadRef.current) {
      skipNextBoardLoadRef.current = false;
      return;
    }

    void loadBoardData(state.currentBoard);
  }, [loadBoardData, state.authLoading, state.currentBoard, state.user]);

  const setCurrentBoard = useCallback((board: Board | null) => {
    setState(prev => {
      if (prev.currentBoard?.id === board?.id) {
        return prev;
      }

      return { ...prev, currentBoard: board };
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      throw error;
    }

    applySession(data.session);
    setError(null);
  }, [applySession, setError]);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      throw error;
    }

    applySession(null);
  }, [applySession, setError]);

  const setViewMode = useCallback((mode: ViewMode) => setState(prev => ({ ...prev, viewMode: mode })), []);
  const setFilterTag = useCallback((tagId: string | null) => setState(prev => ({ ...prev, filterTag: tagId })), []);
  const setFilterPriority = useCallback((priority: Priority | null) => setState(prev => ({ ...prev, filterPriority: priority })), []);
  const setFilterDue = useCallback((filter: 'all' | 'overdue' | 'today' | 'week') => setState(prev => ({ ...prev, filterDue: filter })), []);

  const createBoard = async (name: string) => {
    if (!state.user) {
      const authError = new Error('You must be logged in to create a board');
      setError(authError.message);
      throw authError;
    }

    try {
      const newBoard: Board = {
        id: crypto.randomUUID(),
        name,
        owner_id: state.user.id,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('boards')
        .insert({ id: newBoard.id, name: newBoard.name, owner_id: newBoard.owner_id });
      if (error) {
        console.error('createBoard error:', error);
        setError(error.message);
        throw error;
      }

      const { error: colError } = await supabase.from('columns').insert([
        { board_id: newBoard.id, name: 'Backlog', position: 0 },
        { board_id: newBoard.id, name: 'In Progress', position: 1 },
        { board_id: newBoard.id, name: 'Review', position: 2 },
        { board_id: newBoard.id, name: 'Done', position: 3 },
      ]);
      if (colError) {
        console.error('createBoard columns error:', colError);
        setError(colError.message);
        throw colError;
      }

      setCurrentBoard(newBoard);
      await refreshData(newBoard, state.user.id);
    } catch (err: any) {
      console.error('createBoard error:', err);
      setError(err.message || 'Failed to create board');
      throw err;
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
      const { data, error } = await supabase.from('tags').insert({ board_id: boardId, name, color }).select().single();
      if (error) { console.error('createTag error:', error); setError(error.message); return null; }
      await refreshData();
      return data as Tag;
    } catch (err: any) {
      console.error('createTag error:', err);
      setError(err.message || 'Failed to create tag');
      return null;
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
    <AppContext.Provider value={{ ...state, login, logout, setCurrentBoard, setViewMode, setFilterTag, setFilterPriority, setFilterDue, setError, clearError, createBoard, deleteBoard, createColumn, updateColumn, deleteColumn, reorderColumns, createCard, updateCard, deleteCard, moveCard, reorderCards, createTag, deleteTag, addComment, refreshData }}>
      {children}
    </AppContext.Provider>
  );
}
