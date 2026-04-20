'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isPast } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { CardModal } from './CardModal';
import type { Card } from '@/types';

export function CalendarView() {
  const { cards } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    // Pad start with days from previous month
    const startDay = start.getDay(); // 0 = Sunday
    const prevDays = Array.from({ length: startDay }, (_, i) => new Date(start.getTime() - (startDay - i) * 86400000));
    return [...prevDays, ...allDays];
  }, [currentMonth]);

  const cardsByDay = useMemo(() => {
    const map: Record<string, Card[]> = {};
    cards.forEach(card => {
      if (!card.due_date) return;
      const key = card.due_date;
      if (!map[key]) map[key] = [];
      map[key].push(card);
    });
    return map;
  }, [cards]);

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1));

  return (
    <div className="p-6 space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"><ChevronLeft size={18} /></button>
        <h2 className="text-lg font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"><ChevronRight size={18} /></button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayCards = cardsByDay[key] || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const overdue = isPast(day) && !today;

          return (
            <div
              key={key}
              className={`min-h-[80px] p-1.5 rounded-lg border transition-colors ${inMonth ? 'bg-gray-800/70 border-gray-700' : 'bg-gray-800/30 border-gray-800'} ${today ? 'ring-1 ring-indigo-500' : ''}`}
            >
              <span className={`text-xs font-medium ${inMonth ? (today ? 'text-indigo-400' : overdue ? 'text-red-400' : 'text-gray-400') : 'text-gray-600'}`}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5 overflow-y-auto max-h-[60px]">
                {dayCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate bg-indigo-900/60 text-indigo-200 hover:bg-indigo-800/60 transition-colors"
                  >
                    {card.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCard && <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
