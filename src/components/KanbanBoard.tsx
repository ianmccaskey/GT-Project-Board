'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useApp } from '@/context/AppContext';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { Plus, CalendarDays, LayoutList, Columns3 } from 'lucide-react';
import type { Card } from '@/types';
import { ListView } from './ListView';
import { CalendarView } from './CalendarView';

export function KanbanBoard() {
  const { columns, cards, currentBoard, viewMode, setViewMode, createColumn, moveCard, authLoading } = useApp();
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnIds = useMemo(() => columns.map(c => c.id), [columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find(c => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    // Determine if dropping on a column or a card
    const overColumn = columns.find(c => c.id === overId);
    const overCard = cards.find(c => c.id === overId);

    const activeCard = cards.find(c => c.id === activeCardId);
    if (!activeCard) return;

    if (overColumn) {
      // Dropped on a column — add to end
      const columnCards = cards.filter(c => c.column_id === overColumn.id);
      moveCard(activeCardId, overColumn.id, columnCards.length);
    } else if (overCard) {
      // Dropped on another card
      const toColumnId = overCard.column_id;
      const columnCards = cards.filter(c => c.column_id === toColumnId && c.id !== activeCardId);
      const overIndex = columnCards.findIndex(c => c.id === overId);
      moveCard(activeCardId, toColumnId, overIndex >= 0 ? overIndex : columnCards.length);
    }
  };

  if (authLoading) return <div className="p-8 text-gray-400">Loading boards...</div>;
  if (!currentBoard) return <div className="p-8 text-gray-400">No boards yet for this account</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">{currentBoard.name}</h1>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['board', 'list', 'calendar'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-2 rounded-md transition-colors ${viewMode === mode ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              {mode === 'board' ? <Columns3 size={16} /> : mode === 'list' ? <LayoutList size={16} /> : <CalendarDays size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* Board Content */}
      {viewMode === 'board' ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-6 overflow-x-auto flex-1">
            <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
              {columns.map(column => (
                <KanbanColumn key={column.id} column={column} cards={cards.filter(c => c.column_id === column.id)} />
              ))}
            </SortableContext>
            <button
              onClick={() => createColumn(prompt('Column name:') || 'New Column')}
              className="flex-shrink-0 w-64 h-fit flex items-center justify-center gap-2 bg-gray-800/50 hover:bg-gray-800 border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-xl py-8 text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Plus size={20} /> Add Column
            </button>
          </div>
          <DragOverlay>
            {activeCard && <KanbanCard card={activeCard} isDragging />}
          </DragOverlay>
        </DndContext>
      ) : viewMode === 'list' ? (
        <ListView />
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
