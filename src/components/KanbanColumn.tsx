'use client';

import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useApp } from '@/context/AppContext';
import { KanbanCard } from './KanbanCard';
import { MoreHorizontal, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Column, Card } from '@/types';

export function KanbanColumn({ column, cards }: { column: Column; cards: Card[] }) {
  const { createCard, updateColumn, deleteColumn } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const cardIds = useMemo(() => cards.map(c => c.id), [cards]);

  const handleSave = () => {
    if (editName.trim()) updateColumn(column.id, editName.trim());
    setIsEditing(false);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCardTitle.trim()) {
      createCard(column.id, newCardTitle.trim());
      setNewCardTitle('');
      setAddingCard(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 bg-gray-800/70 rounded-xl flex flex-col max-h-[calc(100vh-140px)] ${isOver ? 'ring-2 ring-indigo-500' : ''}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-700">
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
              className="flex-1 px-2 py-1 text-sm bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <button onClick={handleSave} className="p-1 text-green-400 hover:text-green-300"><Check size={14} /></button>
            <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:text-gray-300"><X size={14} /></button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-200 text-sm">{column.name}</h3>
              <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{cards.length}</span>
            </div>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-1 text-gray-400 hover:text-white rounded">
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-20 overflow-hidden">
                  <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-600">
                    <Pencil size={14} /> Rename
                  </button>
                  <button onClick={() => { if (confirm(`Delete column "${column.name}"?`)) deleteColumn(column.id); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-600">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        <SortableContext items={cardIds} strategy={horizontalListSortingStrategy}>
          {cards.map(card => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {addingCard ? (
          <form onSubmit={handleAddCard} className="space-y-2">
            <textarea
              value={newCardTitle}
              onChange={e => setNewCardTitle(e.target.value)}
              placeholder="Card title..."
              className="w-full px-3 py-2 text-sm bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <button type="submit" className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Add</button>
              <button type="button" onClick={() => setAddingCard(false)} className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 rounded-lg">Cancel</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <Plus size={16} /> Add Card
          </button>
        )}
      </div>
    </div>
  );
}
