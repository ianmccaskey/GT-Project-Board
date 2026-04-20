'use client';

import { useMemo, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { CardModal } from './CardModal';
import { Search, Calendar, ArrowUpDown } from 'lucide-react';
import type { Card, Priority } from '@/types';

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function ListView() {
  const { cards, columns, filterPriority, filterDue, filterTag, setFilterPriority, setFilterDue } = useApp();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'due_date' | 'created'>('priority');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const filtered = useMemo(() => {
    let result = cards;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    if (filterPriority) result = result.filter(c => c.priority === filterPriority);
    if (filterTag) result = result.filter(c => c.tags.some(t => t.id === filterTag));
    if (filterDue === 'overdue') result = result.filter(c => c.due_date && isPast(new Date(c.due_date)) && !isToday(new Date(c.due_date)));
    if (filterDue === 'today') result = result.filter(c => c.due_date && isToday(new Date(c.due_date)));
    if (filterDue === 'week') {
      const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 7);
      result = result.filter(c => c.due_date && new Date(c.due_date) <= weekFromNow);
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === 'due_date') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [cards, search, filterPriority, filterDue, filterTag, sortBy]);

  const getColumn = (id: string) => columns.find(c => c.id === id);

  return (
    <div className="p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..." className="w-full pl-9 pr-3 py-2 text-sm bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500" />
        </div>
        <select value={filterPriority || ''} onChange={e => setFilterPriority(e.target.value as Priority || null)} className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="">All Priorities</option>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={filterDue} onChange={e => setFilterDue(e.target.value as any)} className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500">
          <option value="all">All Dates</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
        </select>
        <button onClick={() => setSortBy(sortBy === 'priority' ? 'due_date' : sortBy === 'due_date' ? 'created' : 'priority')} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 rounded-lg border border-gray-600">
          <ArrowUpDown size={14} /> Sort: {sortBy.replace('_', ' ')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-800/70 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-700/50 text-gray-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Column</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Due Date</th>
              <th className="text-left px-4 py-3 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filtered.map(card => {
              const overdue = card.due_date && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));
              return (
                <tr key={card.id} onClick={() => setSelectedCard(card)} className="hover:bg-gray-700/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{card.title}</td>
                  <td className="px-4 py-3 text-gray-400">{getColumn(card.column_id)?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${{ low: 'bg-green-900/60 text-green-300', medium: 'bg-yellow-900/60 text-yellow-300', high: 'bg-orange-900/60 text-orange-300', urgent: 'bg-red-900/60 text-red-300' }[card.priority]}`}>
                      {card.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {card.due_date ? (
                      <span className={`flex items-center gap-1 ${overdue ? 'text-red-400' : isToday(new Date(card.due_date)) ? 'text-yellow-400' : 'text-gray-400'}`}>
                        <Calendar size={12} /> {format(new Date(card.due_date), 'MMM d')}
                      </span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {card.tags.map(tag => (
                        <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tag.color + '33', color: tag.color }}>{tag.name}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No cards match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedCard && <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  );
}
