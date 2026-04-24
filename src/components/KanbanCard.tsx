'use client';

import { type CSSProperties } from 'react';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import type { DraggableAttributes } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { formatDueDate, formatDueDatePST, isDueOverdue, isDueToday, parseDueDate } from '@/lib/dates';
import { Calendar, MessageSquare, Trash2 } from 'lucide-react';
import type { Card, Priority } from '@/types';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-green-900/60 text-green-300 border-green-700',
  medium: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  high: 'bg-orange-900/60 text-orange-300 border-orange-700',
  urgent: 'bg-red-900/60 text-red-300 border-red-700',
  none: 'bg-gray-700 text-gray-300 border-gray-500',
};

const PRIORITY_BORDER_COLORS: Record<Priority, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  urgent: '#ef4444',
  none: '#6b7280',
};

interface KanbanCardProps {
  card: Card;
  isDragging?: boolean;
  sortable?: boolean;
}

export function KanbanCard({ card, isDragging, sortable = true }: KanbanCardProps) {
  if (!sortable) return <KanbanCardContent card={card} isDragging={isDragging} />;
  return <SortableKanbanCard card={card} isDragging={isDragging} />;
}

function SortableKanbanCard({ card, isDragging }: Pick<KanbanCardProps, 'card' | 'isDragging'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <KanbanCardContent
      card={card}
      isDragging={isDragging}
      isSortableDragging={isSortableDragging}
      setNodeRef={setNodeRef}
      style={style}
      attributes={attributes}
      listeners={listeners}
    />
  );
}

interface KanbanCardContentProps {
  card: Card;
  isDragging?: boolean;
  isSortableDragging?: boolean;
  setNodeRef?: (element: HTMLElement | null) => void;
  style?: CSSProperties;
  attributes?: DraggableAttributes;
  listeners?: Record<string, unknown>;
}

function isDueSoon(dateStr: string | null) {
  const dueDate = parseDueDate(dateStr);
  if (!dueDate) return false;

  const daysUntilDue = differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date()));
  return daysUntilDue > 0 && daysUntilDue <= 7;
}

function KanbanCardContent({
  card,
  isDragging,
  isSortableDragging = false,
  setNodeRef,
  style,
  attributes,
  listeners,
}: KanbanCardContentProps) {
  const { deleteCard, showErrorToast } = useApp();
  const router = useRouter();
  const dueToday = isDueToday(card.due_date);
  const overdue = isDueOverdue(card.due_date);
  const dueSoon = isDueSoon(card.due_date);
  const dueDateLabel = formatDueDate(card.due_date);
  const dueDateTooltip = formatDueDatePST(card.due_date);
  const primaryTag = card.tags[0];
  const priorityBorderColor = PRIORITY_BORDER_COLORS[card.priority];
  const cardStateClasses = overdue
    ? 'border-red-800 bg-red-950/25 hover:bg-red-950/35'
    : 'border-gray-600 bg-gray-700/80 hover:bg-gray-700';
  const dueDateClasses = overdue
    ? 'bg-red-900/60 text-red-300'
    : dueToday
      ? 'bg-yellow-900/60 text-yellow-300'
      : dueSoon
        ? 'bg-orange-900/60 text-orange-300'
        : 'bg-gray-700/70 text-gray-400';

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ ...style, borderLeftColor: priorityBorderColor }}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`Open card: ${card.title}`}
        onClick={() => router.push(`/board/${card.board_id}/card/${card.id}`)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push(`/board/${card.board_id}/card/${card.id}`);
          }
        }}
        className={`relative rounded-lg border border-l-4 p-3 cursor-pointer transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${cardStateClasses} ${isSortableDragging ? 'opacity-50' : ''} ${isDragging ? 'shadow-2xl ring-2 ring-indigo-500' : ''}`}
      >
        {/* Title */}
        <div className="flex items-start gap-2">
          {primaryTag && (
            <span
              className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: primaryTag.color }}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-100 font-medium leading-snug">{card.title}</p>
            {primaryTag && (
              <span
                className="mt-2 inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: `${primaryTag.color}22`, color: primaryTag.color, borderColor: `${primaryTag.color}55` }}
              >
                {primaryTag.name}
              </span>
            )}
          </div>
        </div>

        {/* Description preview */}
        {card.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{card.description}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600/50">
          <div className="flex items-center gap-2">
            {card.due_date && (
              <span
                title={dueDateTooltip}
                className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded ${dueDateClasses}`}
              >
                <Calendar size={11} />
                {dueDateLabel}
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
          aria-label="Delete card"
          onClick={e => {
            e.stopPropagation();
            deleteCard(card.id).catch(() => {
              showErrorToast('Could not delete card. Check your permissions or connection.');
            });
          }}
          className="absolute top-2 right-2 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </>
  );
}
