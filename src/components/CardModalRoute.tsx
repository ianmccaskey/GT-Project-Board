'use client';

import { CardModal } from '@/components/CardModal';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';

interface CardModalRouteProps {
  boardId: string;
  cardId: string;
}

export function CardModalRoute({ boardId, cardId }: CardModalRouteProps) {
  const router = useRouter();
  const { authLoading, cards, currentBoard } = useApp();
  const card = cards.find(entry => entry.id === cardId && entry.board_id === boardId);

  useEffect(() => {
    if (!authLoading && currentBoard?.id === boardId && !card) {
      router.replace(`/board/${boardId}`);
    }
  }, [authLoading, boardId, card, currentBoard?.id, router]);

  if (authLoading || currentBoard?.id !== boardId) {
    return null;
  }

  if (!card) {
    return null;
  }

  return <CardModal card={card} boardId={boardId} />;
}
