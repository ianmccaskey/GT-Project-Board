'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Board, Column, Card, Tag, Comment, Member, Agent, Priority, ViewMode } from '@/types';

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
  members: Member[];
  agents: Agent[];
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
  updateCard: (card: Partial<Card> & { id: string }) => Promise<boolean>;
  deleteCard: (id: string) => Promise<boolean>;
  restoreDeletedCard: (id: string) => Promise<boolean>;
  moveCard: (cardId: string, toColumnId: string, position: number) => Promise<void>;
  reorderCards: (columnId: string, cardIds: string[]) => Promise<void>;
  createTag: (boardId: string, name: string, color: string) => Promise<Tag | null>;
  deleteTag: (id: string) => Promise<void>;
  createMember: (boardId: string, name: string, email: string | null, color: string) => Promise<Member | null>;
  updateMember: (id: string, updates: Partial<Pick<Member, 'name' | 'email' | 'color'>>) => Promise<boolean>;
  deleteMember: (id: string) => Promise<void>;
  createAgent: (boardId: string, name: string, description: string | null, color: string) => Promise<Agent | null>;
  updateAgent: (id: string, updates: Partial<Pick<Agent, 'name' | 'description' | 'color'>>) => Promise<boolean>;
  deleteAgent: (id: string) => Promise<void>;
  addComment: (cardId: string, content: string) => Promise<void>;
  refreshData: () => Promise<void>;
  showErrorToast: (message: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

type AppToast =
  | {
      kind: 'undo-delete';
      cardId: string;
      expiresAt: number;
    }
  | {
      kind: 'error';
      message: string;
      expiresAt: number;
    };

function AppToastPortal({
  toast,
  onDismiss,
  onUndo,
}: {
  toast: AppToast | null;
  onDismiss: () => void;
  onUndo: (cardId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !toast) {
    return null;
  }

  return createPortal(
    <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2">
      {toast.kind === 'undo-delete' ? (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white shadow-2xl">
          Card deleted.
          <button onClick={() => onUndo(toast.cardId)} className="ml-3 font-medium text-indigo-300 hover:text-indigo-200">
            Undo
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-red-700 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-2xl">
          <span>{toast.message}</span>
          <button onClick={onDismiss} className="font-medium text-red-200 hover:text-white">
            Dismiss
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

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
    members: [],
    agents: [],
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
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<AppToast | null>(null);

  useEffect(() => {
    currentBoardRef.current = state.currentBoard;
    userIdRef.current = state.user?.id;
  }, [state.currentBoard, state.user?.id]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const scheduleToast = useCallback((nextToast: AppToast) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast(nextToast);

    const timeoutMs = Math.max(nextToast.expiresAt - Date.now(), 0);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(current => (
        current && current.kind === nextToast.kind && current.expiresAt === nextToast.expiresAt
          ? null
          : current
      ));
      toastTimerRef.current = null;
    }, timeoutMs);
  }, []);

  const showErrorToast = useCallback((message: string) => {
    scheduleToast({
      kind: 'error',
      message,
      expiresAt: Date.now() + 5000,
    });
  }, [scheduleToast]);

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
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .eq('board_id', boardId)
      .is('deleted_at', null)
      .order('position');
    if (error) { console.error('fetchCards error:', error); throw error; }

    // Fetch tags and comments for all cards
    const cardIds = (cards as Card[]).map(c => c.id);

    // Short-circuit when no cards to avoid .in([]) queries
    let cardTags: any[] = [];
    let tags: Tag[] = [];
    let members: Member[] = [];
    let agents: Agent[] = [];
    let cardMembers: { card_id: string; member_id: string }[] = [];
    let cardAgents: { card_id: string; agent_id: string }[] = [];
    let comments: Comment[] = [];

    if (cardIds.length > 0) {
      const [ctResult, tResult, mResult, aResult, cmResult, caResult, cResult] = await Promise.all([
        supabase.from('card_tags').select('*').in('card_id', cardIds),
        supabase.from('tags').select('*').eq('board_id', boardId),
        supabase.from('members').select('*').eq('board_id', boardId),
        supabase.from('agents').select('*').eq('board_id', boardId),
        supabase.from('card_members').select('*').in('card_id', cardIds),
        supabase.from('card_agents').select('*').in('card_id', cardIds),
        supabase.from('comments').select('*').in('card_id', cardIds),
      ]);
      if (ctResult.error) { console.error('fetchCardTags error:', ctResult.error); throw ctResult.error; }
      if (tResult.error) { console.error('fetchTags error:', tResult.error); throw tResult.error; }
      if (mResult.error) { console.error('fetchMembers error:', mResult.error); throw mResult.error; }
      if (aResult.error) { console.error('fetchAgents error:', aResult.error); throw aResult.error; }
      if (cmResult.error) { console.error('fetchCardMembers error:', cmResult.error); throw cmResult.error; }
      if (caResult.error) { console.error('fetchCardAgents error:', caResult.error); throw caResult.error; }
      if (cResult.error) { console.error('fetchComments error:', cResult.error); throw cResult.error; }
      cardTags = ctResult.data || [];
      tags = (tResult.data as Tag[]) || [];
      members = (mResult.data as Member[]) || [];
      agents = (aResult.data as Agent[]) || [];
      cardMembers = cmResult.data || [];
      cardAgents = caResult.data || [];
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
      if (!c.card_id) return;
      if (!commentMap[c.card_id]) commentMap[c.card_id] = [];
      commentMap[c.card_id].push(c);
    });

    const memberById = new Map(members.map(member => [member.id, member]));
    const cardMemberMap: Record<string, Member[]> = {};
    cardMembers.forEach(cardMember => {
      const member = memberById.get(cardMember.member_id);
      if (!member) return;
      if (!cardMemberMap[cardMember.card_id]) cardMemberMap[cardMember.card_id] = [];
      cardMemberMap[cardMember.card_id].push(member);
    });

    const agentById = new Map(agents.map(agent => [agent.id, agent]));
    const cardAgentMap: Record<string, Agent[]> = {};
    cardAgents.forEach(cardAgent => {
      const agent = agentById.get(cardAgent.agent_id);
      if (!agent) return;
      if (!cardAgentMap[cardAgent.card_id]) cardAgentMap[cardAgent.card_id] = [];
      cardAgentMap[cardAgent.card_id].push(agent);
    });

    return (cards as Card[]).map(card => ({
      ...card,
      tags: tagMap[card.id] || [],
      members: cardMemberMap[card.id] || [],
      agents: cardAgentMap[card.id] || [],
      comments: commentMap[card.id] || [],
    }));
  }, []);

  const fetchTags = useCallback(async (boardId: string) => {
    const { data, error } = await supabase.from('tags').select('*').eq('board_id', boardId);
    if (error) { console.error('fetchTags error:', error); throw error; }
    return data as Tag[];
  }, []);

  const fetchMembers = useCallback(async (boardId: string) => {
    const { data, error } = await supabase.from('members').select('*').eq('board_id', boardId).order('name');
    if (error) { console.error('fetchMembers error:', error); throw error; }
    return data as Member[];
  }, []);

  const fetchAgents = useCallback(async (boardId: string) => {
    const { data, error } = await supabase.from('agents').select('*').eq('board_id', boardId).order('name');
    if (error) { console.error('fetchAgents error:', error); throw error; }
    return data as Agent[];
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
        members: [],
        agents: [],
        error: null,
      }));
      return;
    }

    try {
      const boards = await fetchBoards(ownerId);
      let columns: Column[] = [];
      let cards: Card[] = [];
      let tags: Tag[] = [];
      let members: Member[] = [];
      let agents: Agent[] = [];

      const currentBoard = preferredBoard
        ? boards.find(board => board.id === preferredBoard.id) || boards[0] || null
        : boards[0] || null;
      if (currentBoard) {
        [columns, cards, tags, members, agents] = await Promise.all([
          fetchColumns(currentBoard.id),
          fetchCards(currentBoard.id),
          fetchTags(currentBoard.id),
          fetchMembers(currentBoard.id),
          fetchAgents(currentBoard.id),
        ]);
      }

      skipNextBoardLoadRef.current = true;
      setState(prev => ({ ...prev, boards, currentBoard, columns, cards, tags, members, agents, error: null }));
    } catch (err: any) {
      console.error('refreshData error:', err);
      setError(err.message || 'Failed to refresh data');
    }
  }, [fetchAgents, fetchBoards, fetchCards, fetchColumns, fetchMembers, fetchTags, setError]);

  const loadBoardData = useCallback(async (board: Board | null) => {
    if (!board) {
      setState(prev => ({ ...prev, columns: [], cards: [], tags: [], members: [], agents: [], error: null }));
      return;
    }

    try {
      const [columns, cards, tags, members, agents] = await Promise.all([
        fetchColumns(board.id),
        fetchCards(board.id),
        fetchTags(board.id),
        fetchMembers(board.id),
        fetchAgents(board.id),
      ]);

      setState(prev => {
        if (prev.currentBoard?.id !== board.id) {
          return prev;
        }

        return { ...prev, columns, cards, tags, members, agents, error: null };
      });
    } catch (err: any) {
      console.error('loadBoardData error:', err);
      setError(err.message || 'Failed to load board data');
    }
  }, [fetchAgents, fetchCards, fetchColumns, fetchMembers, fetchTags, setError]);

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
        members: session ? prev.members : [],
        agents: session ? prev.agents : [],
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
      const { id, tags, members: _members, agents: _agents, comments: _comments, ...rest } = card;

      if (Object.keys(rest).length > 0) {
        const { error } = await supabase.from('cards').update(rest).eq('id', id);
        if (error) { console.error('updateCard error:', error); setError(error.message); return false; }
      }

      if (tags) {
        const { error: deleteError } = await supabase.from('card_tags').delete().eq('card_id', id);
        if (deleteError) { console.error('updateCard deleteTags error:', deleteError); setError(deleteError.message); return false; }
        if (tags.length > 0) {
          const { error: insertError } = await supabase.from('card_tags').insert(tags.map(t => ({ card_id: id, tag_id: t.id })));
          if (insertError) { console.error('updateCard insertTags error:', insertError); setError(insertError.message); return false; }
        }
      }
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('updateCard error:', err);
      setError(err.message || 'Failed to update card');
      return false;
    }
  };

  const deleteCard = async (id: string) => {
    try {
      const { error } = await supabase.from('cards').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null);
      if (error) {
        console.error('deleteCard error:', error);
        setError(error.message);
        showErrorToast(error.message || 'Failed to delete card');
        return false;
      }
      await refreshData();
      scheduleToast({
        kind: 'undo-delete',
        cardId: id,
        expiresAt: Date.now() + 10000,
      });
      return true;
    } catch (err: any) {
      console.error('deleteCard error:', err);
      setError(err.message || 'Failed to delete card');
      showErrorToast(err.message || 'Failed to delete card');
      return false;
    }
  };

  const restoreDeletedCard = async (id: string) => {
    try {
      const { error } = await supabase.from('cards').update({ deleted_at: null }).eq('id', id);
      if (error) {
        console.error('restoreDeletedCard error:', error);
        setError(error.message);
        showErrorToast(error.message || 'Failed to restore card');
        return false;
      }
      await refreshData();
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      setToast(current => (
        current?.kind === 'undo-delete' && current.cardId === id
          ? null
          : current
      ));
      return true;
    } catch (err: any) {
      console.error('restoreDeletedCard error:', err);
      setError(err.message || 'Failed to restore card');
      showErrorToast(err.message || 'Failed to restore card');
      return false;
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

  const createMember = async (boardId: string, name: string, email: string | null, color: string) => {
    try {
      const { data, error } = await supabase.from('members').insert({ board_id: boardId, name, email, color }).select().single();
      if (error) { console.error('createMember error:', error); setError(error.message); return null; }
      await refreshData();
      return data as Member;
    } catch (err: any) {
      console.error('createMember error:', err);
      setError(err.message || 'Failed to create member');
      return null;
    }
  };

  const updateMember = async (id: string, updates: Partial<Pick<Member, 'name' | 'email' | 'color'>>) => {
    try {
      const { error } = await supabase.from('members').update(updates).eq('id', id);
      if (error) { console.error('updateMember error:', error); setError(error.message); return false; }
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('updateMember error:', err);
      setError(err.message || 'Failed to update member');
      return false;
    }
  };

  const deleteMember = async (id: string) => {
    try {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) { console.error('deleteMember error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('deleteMember error:', err);
      setError(err.message || 'Failed to delete member');
    }
  };

  const createAgent = async (boardId: string, name: string, description: string | null, color: string) => {
    try {
      const { data, error } = await supabase.from('agents').insert({ board_id: boardId, name, description, color }).select().single();
      if (error) { console.error('createAgent error:', error); setError(error.message); return null; }
      await refreshData();
      return data as Agent;
    } catch (err: any) {
      console.error('createAgent error:', err);
      setError(err.message || 'Failed to create agent');
      return null;
    }
  };

  const updateAgent = async (id: string, updates: Partial<Pick<Agent, 'name' | 'description' | 'color'>>) => {
    try {
      const { error } = await supabase.from('agents').update(updates).eq('id', id);
      if (error) { console.error('updateAgent error:', error); setError(error.message); return false; }
      await refreshData();
      return true;
    } catch (err: any) {
      console.error('updateAgent error:', err);
      setError(err.message || 'Failed to update agent');
      return false;
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      const { error } = await supabase.from('agents').delete().eq('id', id);
      if (error) { console.error('deleteAgent error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('deleteAgent error:', err);
      setError(err.message || 'Failed to delete agent');
    }
  };

  const addComment = async (cardId: string, content: string) => {
    try {
      const authorId = state.user?.id;
      if (!authorId) {
        setError('You must be logged in to comment');
        return;
      }

      const { error } = await supabase.from('comments').insert({ card_id: cardId, author_id: authorId, body: content });
      if (error) { console.error('addComment error:', error); setError(error.message); return; }
      await refreshData();
    } catch (err: any) {
      console.error('addComment error:', err);
      setError(err.message || 'Failed to add comment');
    }
  };

  return (
    <AppContext.Provider value={{ ...state, login, logout, setCurrentBoard, setViewMode, setFilterTag, setFilterPriority, setFilterDue, setError, clearError, createBoard, deleteBoard, createColumn, updateColumn, deleteColumn, reorderColumns, createCard, updateCard, deleteCard, restoreDeletedCard, moveCard, reorderCards, createTag, deleteTag, createMember, updateMember, deleteMember, createAgent, updateAgent, deleteAgent, addComment, refreshData, showErrorToast }}>
      {children}
      <AppToastPortal
        toast={toast}
        onDismiss={clearToast}
        onUndo={cardId => {
          void restoreDeletedCard(cardId);
        }}
      />
    </AppContext.Provider>
  );
}
