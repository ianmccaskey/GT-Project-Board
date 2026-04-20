'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast, isToday } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { Calendar, MessageSquare, Tag, Trash2, Edit2, X, Plus } from 'lucide-react';
import type { Card, Priority } from '@/types';
import { CardModal } from './CardModal';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-green-900/60 text-green-300 border-green-700',
  medium: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  high: 'bg-orange-900/60 text-orange-300 border-orange-700',
  urgent: 'bg-red-900/60 text-red-300 border-red-700',
};

export function KanbanCard({ card, isDragging }: { card: Card; isDragging?: boolean }) {
  const { deleteCard } = useApp();
  const [showModal, setShowModal] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = card.due_date && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setShowModal(true)}
        className={`bg-gray-700/80 rounded-lg p-3 cursor-pointer hover:bg-gray-700 transition-colors group border border-gray-600 ${isSortableDragging ? 'opacity-50' : ''} ${isDragging ? 'shadow-2xl ring-2 ring-indigo-500' : ''}`}
      >
        {/* Tags */}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {card.tags.map(tag => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '33', color: tag.color, border: `1px solid ${tag.color}66` }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <p className="text-sm text-gray-100 font-medium leading-snug">{card.title}</p>

        {/* Description preview */}
        {card.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{card.description}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600/50">
          <div className="flex items-center gap-2">
            {card.due_date && (
              <span className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded ${overdue ? 'bg-red-900/60 text-red-300' : isToday(new Date(card.due_date)) ? 'bg-yellow-900/60 text-yellow-300' : 'text-gray-400'}`}>
                <Calendar size={11} />
                {format(new Date(card.due_date), 'MMM d')}
              </span>
            )}
            {card.comments.length > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <MessageSquare size={11} />
                {card.comments.length}
              </span>
            )}
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLORS[card.priority]}`}>
            {card.priority}
          </span>
        </div>

        {/* Delete button */}
        <button
          onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
          className="absolute top-2 right-2 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {showModal && <CardModal card={card} onClose={() => setShowModal(false)} />}
    </>
  );
}
