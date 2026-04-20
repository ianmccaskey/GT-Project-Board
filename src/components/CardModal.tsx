'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { X, Calendar, Tag, MessageSquare, Trash2, Plus, Check } from 'lucide-react';
import type { Card, Priority } from '@/types';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-green-900/60 text-green-300 border-green-700',
  medium: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  high: 'bg-orange-900/60 text-orange-300 border-orange-700',
  urgent: 'bg-red-900/60 text-red-300 border-red-700',
};

const TAG_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const { updateCard, tags, columns, createTag, deleteTag, addComment } = useApp();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.split('T')[0] : '');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newComment, setNewComment] = useState('');

  const column = columns.find(c => c.id === card.column_id);
  const cardTagIds = card.tags.map(t => t.id);

  const handleSave = async () => {
    await updateCard({ ...card, title, description: description || null, priority, due_date: dueDate || null });
    onClose();
  };

  const handleAddTag = async (tag: typeof card.tags[0]) => {
    if (!cardTagIds.includes(tag.id)) {
      await updateCard({ ...card, tags: [...card.tags, tag] });
    }
    setShowAddTag(false);
    setNewTagName('');
  };

  const handleRemoveTag = async (tagId: string) => {
    await updateCard({ ...card, tags: card.tags.filter(t => t.id !== tagId) });
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const { data } = await import('@/lib/supabase').then(m => m.supabase.from('tags').insert({ board_id: card.board_id, name: newTagName.trim(), color: newTagColor }).select().single());
    if (data) {
      await updateCard({ ...card, tags: [...card.tags, data] });
    }
    setNewTagName('');
    setShowAddTag(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addComment(card.id, newComment.trim());
    setNewComment('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-700">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1">{column?.name}</p>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg font-bold text-white resize-none border-none focus:outline-none focus:ring-0"
              rows={1}
            />
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
              <Tag size={14} /> Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {card.tags.map(tag => (
                <span key={tag.id} className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: tag.color + '33', color: tag.color, border: `1px solid ${tag.color}66` }}>
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)} className="hover:text-white"><X size={10} /></button>
                </span>
              ))}
              <button onClick={() => setShowAddTag(!showAddTag)} className="text-xs px-2 py-1 rounded-full border border-dashed border-gray-500 text-gray-400 hover:text-white hover:border-gray-400 flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            {showAddTag && (
              <div className="mt-3 p-3 bg-gray-700/50 rounded-lg space-y-2">
                <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Tag name..." className="w-full px-3 py-1.5 text-sm bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-indigo-500" />
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <button key={color} onClick={() => setNewTagColor(color)} className={`w-6 h-6 rounded-full border-2 ${newTagColor === color ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateTag} className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Create & Add</button>
                  <button onClick={() => setShowAddTag(false)} className="px-3 py-1 text-xs bg-gray-600 text-gray-200 rounded-lg">Cancel</button>
                </div>
                {tags.filter(t => !cardTagIds.includes(t.id)).length > 0 && (
                  <>
                    <p className="text-xs text-gray-400 pt-1">Existing tags:</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.filter(t => !cardTagIds.includes(t.id)).map(tag => (
                        <button key={tag.id} onClick={() => handleAddTag(tag)} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 hover:opacity-80" style={{ backgroundColor: tag.color + '33', color: tag.color, border: `1px solid ${tag.color}66` }}>
                          <Plus size={10} /> {tag.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-300 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description (Markdown supported)..."
              className="w-full px-3 py-2 text-sm bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500 resize-none min-h-[100px]"
              rows={4}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-semibold text-gray-300 mb-2 block">Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => setPriority(p)} className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${priority === p ? PRIORITY_COLORS[p] : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
              <Calendar size={14} /> Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Comments */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
              <MessageSquare size={14} /> Comments
            </label>
            <div className="space-y-3 mb-3">
              {card.comments.map(comment => (
                <div key={comment.id} className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-sm text-gray-200">{comment.content}</p>
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              ))}
              {card.comments.length === 0 && <p className="text-sm text-gray-500">No comments yet</p>}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 text-sm bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
                rows={2}
              />
              <button onClick={handleAddComment} className="self-end px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-700">
          <button onClick={() => { updateCard({ id: card.id, title: card.title }); onClose(); }} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1">
            <Trash2 size={14} /> Delete Card
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1">
              <Check size={14} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
