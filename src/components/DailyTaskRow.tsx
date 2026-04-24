'use client';

import { useMemo } from 'react';
import { isDueToday, parseDueDate } from '@/lib/dates';
import type { Card } from '@/types';
import { KanbanCard } from './KanbanCard';

interface DailyTaskRowProps {
  cards: Card[];
}

export function DailyTaskRow({ cards }: DailyTaskRowProps) {
  const todayCards = useMemo(
    () =>
      cards
        .filter(card => isDueToday(card.due_date))
        .sort((a, b) => (parseDueDate(a.due_date)?.getTime() ?? Infinity) - (parseDueDate(b.due_date)?.getTime() ?? Infinity) || a.position - b.position),
    [cards]
  );

  return (
    <section className="px-6 pt-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Due Today</h2>
            <p className="text-xs text-gray-400">Cards scheduled for today.</p>
          </div>
          <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">{todayCards.length}</span>
        </div>

        {todayCards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 px-4 py-6 text-sm text-gray-400">
            No tasks due today.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {todayCards.map(card => (
              <div key={card.id} className="w-64 flex-shrink-0">
                <KanbanCard card={card} sortable={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
