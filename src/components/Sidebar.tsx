'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Plus, Trash2, Layers } from 'lucide-react';

export function Sidebar() {
  const { boards, currentBoard, setCurrentBoard, createBoard, deleteBoard } = useApp();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createBoard(newName.trim());
      setNewName('');
      setCreating(false);
    } catch {
      // Keep the form open so the user can correct the input or retry.
    }
  };

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Layers size={20} className="text-indigo-400" />
          <span className="font-bold text-white">Kanban</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">Boards</p>
        {boards.map(board => (
          <div key={board.id} className="group flex items-center gap-1">
            <button
              onClick={() => setCurrentBoard(board)}
              className={`flex-1 text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${currentBoard?.id === board.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              {board.name}
            </button>
            {boards.length > 1 && (
              <button
                onClick={() => { if (confirm(`Delete board "${board.name}"?`)) deleteBoard(board.id); }}
                className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {creating ? (
          <form onSubmit={handleCreate} className="mt-2 space-y-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Board name..."
              className="w-full px-3 py-2 text-sm bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <div className="flex gap-1">
              <button type="submit" className="flex-1 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Create</button>
              <button type="button" onClick={() => setCreating(false)} className="flex-1 py-1.5 text-xs bg-gray-700 text-gray-300 rounded-lg">Cancel</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors mt-2"
          >
            <Plus size={16} /> New Board
          </button>
        )}
      </div>
    </div>
  );
}
