'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { KanbanBoard } from '@/components/KanbanBoard';
import { BoardSettings } from '@/components/BoardSettings';
import { useApp } from '@/context/AppContext';

interface BoardShellProps {
  boardId?: string;
  redirectToBoardRoute?: boolean;
}

export function BoardShell({ boardId, redirectToBoardRoute = false }: BoardShellProps) {
  const router = useRouter();
  const { user, authLoading, boards, currentBoard, setCurrentBoard } = useApp();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!boardId || boards.length === 0) {
      return;
    }

    const matchedBoard = boards.find(board => board.id === boardId);

    if (matchedBoard && currentBoard?.id !== matchedBoard.id) {
      setCurrentBoard(matchedBoard);
      return;
    }

    if (!matchedBoard && currentBoard) {
      router.replace(`/board/${currentBoard.id}`);
    }
  }, [boardId, boards, currentBoard, router, setCurrentBoard]);

  useEffect(() => {
    if (!redirectToBoardRoute || authLoading || !user || !currentBoard) {
      return;
    }

    router.replace(`/board/${currentBoard.id}`);
  }, [authLoading, currentBoard, redirectToBoardRoute, router, user]);

  if (authLoading || !user) {
    return <main className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading...</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {currentBoard && (
          <header className="flex items-center justify-between border-b border-gray-700 px-6 py-3">
            <div>
              <h1 className="text-lg font-bold text-white">{currentBoard.name}</h1>
              <p className="text-sm text-gray-400">Board settings, tags, and view controls live here.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-700 hover:text-white"
            >
              <Settings2 size={16} />
              Settings
            </button>
          </header>
        )}
        <KanbanBoard />
        {currentBoard && (
          <BoardSettings
            boardId={currentBoard.id}
            boardName={currentBoard.name}
            open={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </main>
    </>
  );
}
