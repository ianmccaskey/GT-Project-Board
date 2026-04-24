'use client';

import { useEffect, useRef, useState } from 'react';
import {
  format,
  formatDistanceToNow,
} from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Tag as TagIcon,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { buildDueDateValue, formatDueDate, formatDueDatePST, getDueDateInputValue, getDueTimeInputValue } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type {
  ActivityEvent,
  Agent,
  Assignee,
  Card,
  Checklist,
  ChecklistItem,
  Comment,
  Member,
  Milestone,
  Priority,
  Tag,
} from '@/types';

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'urgent'];
const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
const PRIORITY_COLORS: Record<Priority, string> = {
  none: 'bg-gray-700 text-gray-300 border-gray-500',
  low: 'bg-green-900/60 text-green-300 border-green-700',
  medium: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  high: 'bg-orange-900/60 text-orange-300 border-orange-700',
  urgent: 'bg-red-900/60 text-red-300 border-red-700',
};
const TAG_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const MEMBER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

type ActivityFilter = 'all' | 'comments';

interface ModalCardState {
  title: string;
  description: string;
  priority: Priority;
  tagId: string | null;
  dueDate: string;
  dueTime: string;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function getChecklistProgress(items: ChecklistItem[]) {
  if (items.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = items.filter(item => item.done).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

function getMilestoneCompletion(milestone: Milestone, items: ChecklistItem[]) {
  const linkedItems = items.filter(item => item.milestone_id === milestone.id);
  if (linkedItems.length === 0) return milestone.completed;
  return linkedItems.every(item => item.done);
}

function Avatar({ member }: { member: Member }) {
  return (
    <span
      title={member.name}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: member.color }}
    >
      {getInitials(member.name)}
    </span>
  );
}

function AgentAvatar({ agent }: { agent: Agent }) {
  return (
    <span
      title={agent.name}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed text-white"
      style={{ backgroundColor: `${agent.color}33`, borderColor: agent.color }}
    >
      <Bot size={15} style={{ color: agent.color }} />
      <span className="absolute -bottom-1 -right-1 rounded bg-sky-500 px-1 text-[8px] font-bold uppercase leading-3 text-white">
        AI
      </span>
    </span>
  );
}

function AssigneeBadge({
  assignee,
  membersById,
  agentsById,
}: {
  assignee: Assignee;
  membersById: Map<string, Member>;
  agentsById: Map<string, Agent>;
}) {
  if (!assignee) return null;

  if (assignee.type === 'member') {
    const member = membersById.get(assignee.id);
    if (!member) return null;
    return (
      <span title={member.name} className="inline-flex">
        <Avatar member={member} />
      </span>
    );
  }

  const agent = agentsById.get(assignee.id);
  if (!agent) return null;

  return (
    <span title={agent.name} className="inline-flex">
      <AgentAvatar agent={agent} />
    </span>
  );
}

function getItemAssignee(item: ChecklistItem): Assignee {
  if (!item.assignee_type || !item.assignee_id) return null;
  return { type: item.assignee_type, id: item.assignee_id };
}

export function CardModal({ card, boardId }: { card: Card; boardId: string }) {
  const router = useRouter();
  const {
    user,
    userName,
    columns,
    tags,
    members,
    agents,
    cards,
    updateCard,
    createTag,
    createMember,
    createAgent,
    deleteCard,
    refreshData,
    showErrorToast,
  } = useApp();

  const [draft, setDraft] = useState<ModalCardState>({
    title: card.title,
    description: card.description ?? '',
    priority: card.priority,
    tagId: card.tag_id,
    dueDate: getDueDateInputValue(card.due_date),
    dueTime: getDueTimeInputValue(card.due_date),
  });
  const [savedVisible, setSavedVisible] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [watching, setWatching] = useState(card.watchers?.includes(user?.id ?? '') ?? false);
  const [commentInput, setCommentInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<Comment[]>(card.comments);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<Record<string, string>>({});
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const titleTimerRef = useRef<number | null>(null);
  const descriptionTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const dueDateSectionRef = useRef<HTMLDivElement | null>(null);
  const tagSectionRef = useRef<HTMLDivElement | null>(null);
  const membersSectionRef = useRef<HTMLDivElement | null>(null);
  const agentsSectionRef = useRef<HTMLDivElement | null>(null);
  const milestonesSectionRef = useRef<HTMLDivElement | null>(null);
  const checklistsSectionRef = useRef<HTMLDivElement | null>(null);

  const liveCard = cards.find(entry => entry.id === card.id) ?? card;
  const column = columns.find(entry => entry.id === liveCard.column_id);
  const activeTag = tags.find(tag => tag.id === draft.tagId) ?? null;
  const cardMembers = liveCard.members;
  const cardAgents = liveCard.agents;
  const membersById = new Map(members.map(member => [member.id, member]));
  const agentsById = new Map(agents.map(agent => [agent.id, agent]));
  const overallProgress = getChecklistProgress(checklistItems);
  const currentMilestone = milestones.find(milestone => !getMilestoneCompletion(milestone, checklistItems)) ?? null;
  const visibleCommentsAndActivity = [
    ...comments.map(comment => ({ type: 'comment' as const, createdAt: comment.created_at, item: comment })),
    ...(activityFilter === 'all'
      ? activityEvents.map(event => ({ type: 'event' as const, createdAt: event.created_at, item: event }))
      : []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    setDraft({
      title: card.title,
      description: card.description ?? '',
      priority: card.priority,
      tagId: card.tag_id,
      dueDate: getDueDateInputValue(card.due_date),
      dueTime: getDueTimeInputValue(card.due_date),
    });
    setWatching(card.watchers?.includes(user?.id ?? '') ?? false);
    setComments(card.comments);
  }, [card, user?.id]);

  useEffect(() => {
    async function loadCardSections() {
      setLoadingSections(true);

      const [milestonesResult, checklistsResult, itemsResult, commentsResult, activityResult] = await Promise.all([
        supabase.from('milestones').select('*').eq('card_id', card.id).order('order_index'),
        supabase.from('checklists').select('*').eq('card_id', card.id).order('order_index'),
        supabase
          .from('checklist_items')
          .select('*, checklists!inner(card_id)')
          .eq('checklists.card_id', card.id)
          .order('order_index'),
        supabase.from('comments').select('*').eq('card_id', card.id).order('created_at', { ascending: false }),
        supabase.from('activity_events').select('*').eq('card_id', card.id).order('created_at', { ascending: false }),
      ]);

      if (!milestonesResult.error) setMilestones((milestonesResult.data as Milestone[]) ?? []);
      if (!checklistsResult.error) setChecklists((checklistsResult.data as Checklist[]) ?? []);
      if (!itemsResult.error) {
        const flattened = ((itemsResult.data as Array<ChecklistItem & { checklists: { card_id: string } }>) ?? []).map(({ checklists: _checklists, ...item }) => item);
        setChecklistItems(flattened);
      }
      if (!commentsResult.error) setComments((commentsResult.data as Comment[]) ?? []);
      if (!activityResult.error) setActivityEvents((activityResult.data as ActivityEvent[]) ?? []);

      setLoadingSections(false);
    }

    loadCardSections();
  }, [card.id]);

  useEffect(() => {
    const initialExpanded: Record<string, boolean> = { unassigned: true };
    if (currentMilestone) initialExpanded[currentMilestone.id] = true;
    setExpandedGroups(prev => ({ ...initialExpanded, ...prev }));
  }, [currentMilestone?.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeModal();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    return () => {
      if (titleTimerRef.current) window.clearTimeout(titleTimerRef.current);
      if (descriptionTimerRef.current) window.clearTimeout(descriptionTimerRef.current);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function loadCardSections() {
    const [milestonesResult, checklistsResult, itemsResult, commentsResult, activityResult] = await Promise.all([
      supabase.from('milestones').select('*').eq('card_id', card.id).order('order_index'),
      supabase.from('checklists').select('*').eq('card_id', card.id).order('order_index'),
      supabase
        .from('checklist_items')
        .select('*, checklists!inner(card_id)')
        .eq('checklists.card_id', card.id)
        .order('order_index'),
      supabase.from('comments').select('*').eq('card_id', card.id).order('created_at', { ascending: false }),
      supabase.from('activity_events').select('*').eq('card_id', card.id).order('created_at', { ascending: false }),
    ]);

    if (!milestonesResult.error) setMilestones((milestonesResult.data as Milestone[]) ?? []);
    if (!checklistsResult.error) setChecklists((checklistsResult.data as Checklist[]) ?? []);
    if (!itemsResult.error) {
      const flattened = ((itemsResult.data as Array<ChecklistItem & { checklists: { card_id: string } }>) ?? []).map(({ checklists: _checklists, ...item }) => item);
      setChecklistItems(flattened);
    }
    if (!commentsResult.error) setComments((commentsResult.data as Comment[]) ?? []);
    if (!activityResult.error) setActivityEvents((activityResult.data as ActivityEvent[]) ?? []);
  }

  function closeModal() {
    window.history.back();
  }

  function flashSaved() {
    setSavedVisible(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedVisible(false), 1600);
  }

  async function logActivity(eventType: string, payload: Record<string, unknown> | null = null) {
    await supabase.from('activity_events').insert({
      card_id: card.id,
      actor_id: user?.id ?? null,
      event_type: eventType,
      payload,
    });
  }

  async function saveCardPatch(field: string, patch: Partial<Card>) {
    setSavingField(field);
    const ok = await updateCard({ id: card.id, ...patch });
    setSavingField(current => (current === field ? null : current));
    if (ok) flashSaved();
    return ok;
  }

  function queueTitleSave(nextTitle: string) {
    if (titleTimerRef.current) window.clearTimeout(titleTimerRef.current);
    titleTimerRef.current = window.setTimeout(async () => {
      if (nextTitle.trim() && nextTitle !== liveCard.title) {
        await saveCardPatch('title', { title: nextTitle.trim() });
      }
    }, 300);
  }

  function queueDescriptionSave(nextDescription: string) {
    if (descriptionTimerRef.current) window.clearTimeout(descriptionTimerRef.current);
    descriptionTimerRef.current = window.setTimeout(async () => {
      const normalized = nextDescription.trim() ? nextDescription : null;
      if ((liveCard.description ?? null) !== normalized) {
        await saveCardPatch('description', { description: normalized });
      }
    }, 300);
  }

  async function handlePriorityChange(priority: Priority) {
    setDraft(current => ({ ...current, priority }));
    const ok = await saveCardPatch('priority', { priority });
    if (ok && priority !== liveCard.priority) {
      await logActivity('priority_changed', { from: liveCard.priority, to: priority });
      await loadCardSections();
    }
  }

  async function handleTagChange(tagId: string | null) {
    setDraft(current => ({ ...current, tagId }));
    const nextTag = tagId ? tags.find(tag => tag.id === tagId) : null;
    const nextTags = nextTag ? [nextTag] : [];
    const ok = await saveCardPatch('tag', { tag_id: tagId, tags: nextTags });
    if (ok) {
      setShowTagPicker(false);
      await loadCardSections();
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    const createdTag = await createTag(boardId, newTagName.trim(), newTagColor);
    if (!createdTag) return;
    setNewTagName('');
    // Set draft and save directly — don't call handleTagChange (stale tags array race)
    setDraft(current => ({ ...current, tagId: createdTag.id }));
    const ok = await updateCard({ id: card.id, tag_id: createdTag.id, tags: [createdTag] });
    if (ok) {
      setShowTagPicker(false);
      await loadCardSections();
    }
  }

  async function handleDueDateSave(nextDueDate: string, nextDueTime: string) {
    const dueDateValue = nextDueDate ? buildDueDateValue(nextDueDate, nextDueTime || '12:00') : null;
    const previousValue = liveCard.due_date;
    const ok = await saveCardPatch('due_date', { due_date: dueDateValue });
    if (ok && previousValue !== dueDateValue) {
      const eventType = dueDateValue ? (previousValue ? 'due_date_changed' : 'due_date_set') : 'due_date_cleared';
      await logActivity(eventType, { from: previousValue, to: dueDateValue });
      await loadCardSections();
    }
  }

  async function handleMembersChange(member: Member, shouldAdd: boolean) {
    if (shouldAdd) {
      await supabase.from('card_members').insert({ card_id: card.id, member_id: member.id });
      await logActivity('member_added', { memberId: member.id, memberName: member.name });
    } else {
      await supabase.from('card_members').delete().eq('card_id', card.id).eq('member_id', member.id);
      await logActivity('member_removed', { memberId: member.id, memberName: member.name });
    }
    await refreshData();
    await loadCardSections();
    flashSaved();
  }

  async function handleAgentsChange(agent: Agent, shouldAdd: boolean) {
    if (shouldAdd) {
      await supabase.from('card_agents').insert({ card_id: card.id, agent_id: agent.id });
      await logActivity('agent_added', { agentId: agent.id, agentName: agent.name });
    } else {
      await supabase.from('card_agents').delete().eq('card_id', card.id).eq('agent_id', agent.id);
      await logActivity('agent_removed', { agentId: agent.id, agentName: agent.name });
    }
    await refreshData();
    await loadCardSections();
    flashSaved();
  }

  async function handleCreateMember() {
    if (!newMemberName.trim()) return;
    const created = await createMember(
      boardId,
      newMemberName.trim(),
      newMemberEmail.trim() || null,
      MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)] ?? MEMBER_COLORS[0]
    );
    if (!created) return;
    setNewMemberName('');
    setNewMemberEmail('');
    await handleMembersChange(created, true);
  }

  async function handleCreateAgent() {
    if (!newAgentName.trim()) return;
    const created = await createAgent(
      boardId,
      newAgentName.trim(),
      newAgentDescription.trim() || null,
      MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)] ?? MEMBER_COLORS[0]
    );
    if (!created) return;
    setNewAgentName('');
    setNewAgentDescription('');
    await handleAgentsChange(created, true);
  }

  async function handleWatchToggle() {
    const userId = user?.id;
    if (!userId) return;
    const nextWatching = !watching;
    const nextWatchers = nextWatching
      ? Array.from(new Set([...(liveCard.watchers ?? []), userId]))
      : (liveCard.watchers ?? []).filter(watcherId => watcherId !== userId);
    setWatching(nextWatching);
    await saveCardPatch('watchers', { watchers: nextWatchers });
  }

  async function handleAddMilestone() {
    if (!newMilestoneName.trim()) return;
    const { error } = await supabase.from('milestones').insert({
      card_id: card.id,
      name: newMilestoneName.trim(),
      order_index: milestones.length,
      color: TAG_COLORS[milestones.length % TAG_COLORS.length],
      completed: false,
    });
    if (error) return;
    setNewMilestoneName('');
    await logActivity('milestone_added', { name: newMilestoneName.trim() });
    await loadCardSections();
    flashSaved();
  }

  async function handleRenameMilestone(milestoneId: string, name: string) {
    const { error } = await supabase.from('milestones').update({ name }).eq('id', milestoneId);
    if (error) return;
    await loadCardSections();
    flashSaved();
  }

  async function handleToggleMilestone(milestone: Milestone) {
    const nextCompleted = !getMilestoneCompletion(milestone, checklistItems);
    const { error } = await supabase.from('milestones').update({ completed: nextCompleted }).eq('id', milestone.id);
    if (error) return;
    await logActivity(nextCompleted ? 'milestone_completed' : 'milestone_reopened', { milestoneId: milestone.id, name: milestone.name });
    await loadCardSections();
    flashSaved();
  }

  async function handleMoveMilestone(milestoneId: string, direction: -1 | 1) {
    const index = milestones.findIndex(milestone => milestone.id === milestoneId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= milestones.length) return;

    const reordered = [...milestones];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    await Promise.all(reordered.map((milestone, orderIndex) => (
      supabase.from('milestones').update({ order_index: orderIndex }).eq('id', milestone.id)
    )));
    await loadCardSections();
    flashSaved();
  }

  async function handleAddChecklist() {
    if (!newChecklistName.trim()) return;
    const { error } = await supabase.from('checklists').insert({
      card_id: card.id,
      name: newChecklistName.trim(),
      order_index: checklists.length,
    });
    if (error) return;
    setNewChecklistName('');
    await loadCardSections();
    flashSaved();
  }

  async function handleRenameChecklist(checklistId: string, name: string) {
    const { error } = await supabase.from('checklists').update({ name }).eq('id', checklistId);
    if (error) return;
    await loadCardSections();
    flashSaved();
  }

  async function handleAddChecklistItem(checklistId: string, milestoneId: string | null) {
    const text = (newChecklistItems[`${checklistId}:${milestoneId ?? 'unassigned'}`] ?? '').trim();
    if (!text) return;
    const groupItems = checklistItems.filter(item => item.checklist_id === checklistId && item.milestone_id === milestoneId);
    const { error } = await supabase.from('checklist_items').insert({
      checklist_id: checklistId,
      text,
      done: false,
      order_index: groupItems.length,
      milestone_id: milestoneId,
    });
    if (error) return;
    setNewChecklistItems(current => ({ ...current, [`${checklistId}:${milestoneId ?? 'unassigned'}`]: '' }));
    await logActivity('checklist_item_added', { checklistId, milestoneId, text });
    await loadCardSections();
    flashSaved();
  }

  async function handleUpdateChecklistItem(itemId: string, updates: Partial<ChecklistItem>) {
    const { error } = await supabase.from('checklist_items').update(updates).eq('id', itemId);
    if (error) return;
    await loadCardSections();
    flashSaved();
  }

  async function handleToggleChecklistItem(item: ChecklistItem) {
    await handleUpdateChecklistItem(item.id, { done: !item.done });
    await logActivity(item.done ? 'checklist_item_unchecked' : 'checklist_item_checked', { itemId: item.id, text: item.text });
  }

  async function handleDeleteChecklistItem(item: ChecklistItem) {
    const { error } = await supabase.from('checklist_items').delete().eq('id', item.id);
    if (error) return;
    await logActivity('checklist_item_deleted', { itemId: item.id, text: item.text });
    await loadCardSections();
    flashSaved();
  }

  async function handleCommentSubmit() {
    const body = commentInput.trim();
    if (!body || !user?.id) return;
    const { error } = await supabase.from('comments').insert({ card_id: card.id, author_id: user.id, body });
    if (error) return;
    setCommentInput('');
    await loadCardSections();
    await refreshData();
    flashSaved();
  }

  async function handleCommentDelete(commentId: string) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) return;
    await loadCardSections();
    await refreshData();
    flashSaved();
  }

  async function handleCommentEdit(commentId: string) {
    const body = editingCommentBody.trim();
    if (!body) return;
    const { error } = await supabase.from('comments').update({
      body,
      edited: true,
      updated_at: new Date().toISOString(),
    }).eq('id', commentId);
    if (error) return;
    setEditingCommentId(null);
    setEditingCommentBody('');
    await loadCardSections();
    await refreshData();
    flashSaved();
  }

  async function handleDeleteCard() {
    const ok = await deleteCard(card.id);
    if (!ok) {
      showErrorToast('Could not delete card. Check your permissions or connection and try again.');
      return;
    }
    setShowDeleteConfirm(false);
    await logActivity('card_deleted', {});
    closeModal();
  }

  function jumpToSection(ref: React.RefObject<HTMLDivElement | null>, after: () => void) {
    after();
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const addButtons = [
    { label: 'Add Project Tag', action: () => jumpToSection(tagSectionRef, () => setShowTagPicker(true)) },
    { label: 'Add Due Date', action: () => jumpToSection(dueDateSectionRef, () => undefined) },
    { label: 'Add Members', action: () => jumpToSection(membersSectionRef, () => setShowMemberPicker(true)) },
    { label: 'Add Agent', action: () => jumpToSection(agentsSectionRef, () => setShowAgentPicker(true)) },
    { label: 'Add Milestones', action: () => jumpToSection(milestonesSectionRef, () => undefined) },
    { label: 'Add Checklist', action: () => jumpToSection(checklistsSectionRef, () => undefined) },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={closeModal} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6">
        <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <button title="Coming soon" className="rounded-lg border border-gray-700 p-2 hover:border-gray-600 hover:text-gray-200">
                <Paperclip size={16} />
              </button>
              <button
                onClick={handleWatchToggle}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${watching ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200' : 'border-gray-700 text-gray-300 hover:border-gray-600'}`}
              >
                {watching ? 'Watching' : 'Watch'}
              </button>
              <span className={`transition-opacity ${savedVisible ? 'opacity-100' : 'opacity-0'} text-emerald-400`}>
                Saved <Check size={14} className="inline" />
              </span>
              {savingField && <span className="text-xs text-gray-500">Saving {savingField}...</span>}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(current => !current)}
                  className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:border-gray-600 hover:text-white"
                >
                  <MoreHorizontal size={16} />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-11 z-10 w-48 rounded-xl border border-gray-700 bg-gray-800 p-1 shadow-xl">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}/card/${card.id}`);
                        setShowMoreMenu(false);
                        flashSaved();
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
                    >
                      Copy link to card
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-gray-700"
                    >
                      Delete card
                    </button>
                  </div>
                )}
              </div>
              <button onClick={closeModal} className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:border-gray-600 hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,2fr)_380px]">
            <div className="min-h-0 overflow-y-auto border-b border-gray-800 md:border-b-0 md:border-r">
              <div className="space-y-8 px-4 py-5 md:px-6">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gray-500">{column?.name ?? 'Card'}</p>
                  <textarea
                    ref={titleRef}
                    value={draft.title}
                    onChange={event => {
                      const value = event.target.value;
                      setDraft(current => ({ ...current, title: value }));
                      queueTitleSave(value);
                    }}
                    onBlur={async () => {
                      const trimmed = draft.title.trim();
                      if (trimmed && trimmed !== liveCard.title) {
                        await saveCardPatch('title', { title: trimmed });
                      }
                    }}
                    rows={1}
                    className="w-full resize-none border-none bg-transparent p-0 text-3xl font-semibold leading-tight text-white outline-none"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {addButtons.map(button => (
                      <button
                        key={button.label}
                        onClick={button.action}
                        className="rounded-full border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white"
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div ref={dueDateSectionRef} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Calendar size={15} />
                    Due Date
                  </div>
                  <div className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-950/60 p-4 sm:flex-row sm:items-center">
                    <input
                      type="date"
                      value={draft.dueDate}
                      onChange={async event => {
                        const value = event.target.value;
                        const nextTime = draft.dueDate ? draft.dueTime : '12:00';
                        setDraft(current => ({ ...current, dueDate: value, dueTime: current.dueDate ? current.dueTime : '12:00' }));
                        await handleDueDateSave(value, value ? nextTime : '');
                      }}
                      title={formatDueDatePST(liveCard.due_date) || undefined}
                      className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    />
                    <input
                      type="time"
                      value={draft.dueTime}
                      onChange={async event => {
                        const value = event.target.value;
                        setDraft(current => ({ ...current, dueTime: value }));
                        if (draft.dueDate) await handleDueDateSave(draft.dueDate, value);
                      }}
                      className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={async () => {
                        setDraft(current => ({ ...current, dueDate: '', dueTime: '12:00' }));
                        await handleDueDateSave('', '');
                      }}
                      className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
                    >
                      Clear
                    </button>
                    <div className="text-xs text-gray-400">
                      {liveCard.due_date ? formatDueDate(liveCard.due_date) : 'Open'}
                    </div>
                  </div>
                </div>

                <div ref={tagSectionRef} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <TagIcon size={15} />
                    Project Tag
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {activeTag ? (
                        <button
                          onClick={() => setShowTagPicker(current => !current)}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
                          style={{ backgroundColor: `${activeTag.color}22`, color: activeTag.color, borderColor: `${activeTag.color}66` }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeTag.color }} />
                          {activeTag.name}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowTagPicker(true)}
                          className="rounded-full border border-dashed border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
                        >
                          Add tag
                        </button>
                      )}
                      {activeTag && (
                        <button
                          onClick={() => handleTagChange(null)}
                          className="text-sm text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {showTagPicker && (
                      <div className="mt-4 space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
                        <div className="flex flex-wrap gap-2">
                          {tags.map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => handleTagChange(tag.id)}
                              className={`rounded-full border px-3 py-1.5 text-sm ${draft.tagId === tag.id ? 'ring-2 ring-white/30' : ''}`}
                              style={{ backgroundColor: `${tag.color}22`, color: tag.color, borderColor: `${tag.color}66` }}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <input
                            value={newTagName}
                            onChange={event => setNewTagName(event.target.value)}
                            placeholder="Create new tag"
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <div className="flex flex-wrap gap-2">
                            {TAG_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => setNewTagColor(color)}
                                className={`h-7 w-7 rounded-full border-2 ${newTagColor === color ? 'border-white' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <button
                            onClick={handleCreateTag}
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                          >
                            Create tag
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div ref={membersSectionRef} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Users size={15} />
                    Members
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {cardMembers.length > 0 ? cardMembers.map(member => (
                        <button
                          key={member.id}
                          onClick={() => handleMembersChange(member, false)}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-700 px-2 py-1 pr-3 text-sm text-gray-200 hover:border-gray-600"
                        >
                          <Avatar member={member} />
                          {member.name}
                          <X size={12} />
                        </button>
                      )) : <p className="text-sm text-gray-500">No members yet. Add Members above.</p>}
                    </div>
                    <button
                      onClick={() => setShowMemberPicker(current => !current)}
                      className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
                    >
                      {showMemberPicker ? 'Hide members' : 'Manage members'}
                    </button>
                    {showMemberPicker && (
                      <div className="mt-4 space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
                        <div className="space-y-2">
                          {members.map(member => {
                            const selected = cardMembers.some(entry => entry.id === member.id);
                            return (
                              <button
                                key={member.id}
                                onClick={() => handleMembersChange(member, !selected)}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${selected ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-gray-700 text-gray-300 hover:border-gray-600'}`}
                              >
                                <span className="flex items-center gap-3">
                                  <Avatar member={member} />
                                  <span>
                                    <span className="block">{member.name}</span>
                                    {member.email && <span className="block text-xs text-gray-500">{member.email}</span>}
                                  </span>
                                </span>
                                {selected && <Check size={16} />}
                              </button>
                            );
                          })}
                        </div>
                        <div className="space-y-2 border-t border-gray-800 pt-4">
                          <input
                            value={newMemberName}
                            onChange={event => setNewMemberName(event.target.value)}
                            placeholder="New member name"
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            value={newMemberEmail}
                            onChange={event => setNewMemberEmail(event.target.value)}
                            placeholder="Email (optional)"
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={handleCreateMember}
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                          >
                            Create member
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div ref={agentsSectionRef} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Bot size={15} />
                    Agents
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {cardAgents.length > 0 ? cardAgents.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => handleAgentsChange(agent, false)}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-700 px-2 py-1 pr-3 text-sm text-gray-200 hover:border-gray-600"
                        >
                          <AgentAvatar agent={agent} />
                          {agent.name}
                          <X size={12} />
                        </button>
                      )) : <p className="text-sm text-gray-500">No agents yet. Add Agent above.</p>}
                    </div>
                    <button
                      onClick={() => setShowAgentPicker(current => !current)}
                      className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-600 hover:text-white"
                    >
                      {showAgentPicker ? 'Hide agents' : 'Manage agents'}
                    </button>
                    {showAgentPicker && (
                      <div className="mt-4 space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
                        <div className="space-y-2">
                          {agents.map(agent => {
                            const selected = cardAgents.some(entry => entry.id === agent.id);
                            return (
                              <button
                                key={agent.id}
                                onClick={() => handleAgentsChange(agent, !selected)}
                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${selected ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-gray-700 text-gray-300 hover:border-gray-600'}`}
                              >
                                <span className="flex items-center gap-3">
                                  <AgentAvatar agent={agent} />
                                  <span>
                                    <span className="block">{agent.name}</span>
                                    {agent.description && <span className="block text-xs text-gray-500">{agent.description}</span>}
                                  </span>
                                </span>
                                {selected && <Check size={16} />}
                              </button>
                            );
                          })}
                        </div>
                        <div className="space-y-2 border-t border-gray-800 pt-4">
                          <input
                            value={newAgentName}
                            onChange={event => setNewAgentName(event.target.value)}
                            placeholder="New agent name"
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            value={newAgentDescription}
                            onChange={event => setNewAgentDescription(event.target.value)}
                            placeholder="Description (optional)"
                            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={handleCreateAgent}
                            className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                          >
                            Create agent
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <Clock3 size={15} />
                    Priority
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITIES.map(priority => (
                      <button
                        key={priority}
                        onClick={() => handlePriorityChange(priority)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${draft.priority === priority ? PRIORITY_COLORS[priority] : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'}`}
                      >
                        {PRIORITY_LABELS[priority]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-200">Description</div>
                    <div className="text-xs text-gray-500">Markdown supported</div>
                  </div>
                  <textarea
                    value={draft.description}
                    onChange={event => {
                      const value = event.target.value;
                      setDraft(current => ({ ...current, description: value }));
                      queueDescriptionSave(value);
                    }}
                    onBlur={async () => {
                      const normalized = draft.description.trim() ? draft.description : null;
                      if ((liveCard.description ?? null) !== normalized) {
                        await saveCardPatch('description', { description: normalized });
                      }
                    }}
                    rows={6}
                    placeholder="Add a description..."
                    className="min-h-[140px] w-full rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div ref={milestonesSectionRef} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-200">Milestones</div>
                    <div className="text-xs text-gray-500">{milestones.length} total</div>
                  </div>
                  <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                    {loadingSections ? (
                      <div className="text-sm text-gray-500">Loading milestones...</div>
                    ) : milestones.length > 0 ? (
                      <>
                        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
                          {milestones.map((milestone, index) => {
                            const completed = getMilestoneCompletion(milestone, checklistItems);
                            const current = currentMilestone?.id === milestone.id;
                            return (
                              <div key={milestone.id} className="flex min-w-0 items-center gap-2">
                                <div className="flex min-w-[120px] items-center gap-2">
                                  <span
                                    className={`h-4 w-4 rounded-full border-2 ${completed ? 'border-transparent' : current ? 'border-white/80' : 'border-gray-600'}`}
                                    style={{ backgroundColor: completed ? (milestone.color ?? '#22c55e') : current ? (milestone.color ?? '#3b82f6') : '#111827' }}
                                  />
                                  <span className={`truncate text-xs ${current ? 'text-white' : 'text-gray-400'}`}>{milestone.name}</span>
                                </div>
                                {index < milestones.length - 1 && <div className="h-px w-10 bg-gray-700" />}
                              </div>
                            );
                          })}
                        </div>
                        <div className="space-y-2">
                          {milestones.map(milestone => {
                            const completed = getMilestoneCompletion(milestone, checklistItems);
                            return (
                              <div key={milestone.id} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
                                <button onClick={() => handleToggleMilestone(milestone)} className="text-gray-300 hover:text-white">
                                  {completed ? <CheckCircle2 size={17} className="text-emerald-400" /> : <Check size={17} />}
                                </button>
                                <input
                                  defaultValue={milestone.name}
                                  onBlur={event => {
                                    const value = event.target.value.trim();
                                    if (value && value !== milestone.name) void handleRenameMilestone(milestone.id, value);
                                  }}
                                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                                />
                                <button onClick={() => handleMoveMilestone(milestone.id, -1)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
                                  ↑
                                </button>
                                <button onClick={() => handleMoveMilestone(milestone.id, 1)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
                                  ↓
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">No milestones yet. Add Milestones above.</div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <input
                        value={newMilestoneName}
                        onChange={event => setNewMilestoneName(event.target.value)}
                        placeholder="New milestone"
                        className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddMilestone}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div ref={checklistsSectionRef} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-200">Checklists</div>
                    <div className="text-xs text-gray-500">{overallProgress.done}/{overallProgress.total} done</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${overallProgress.pct}%` }} />
                  </div>
                  <div className="space-y-4">
                    {loadingSections ? (
                      <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 text-sm text-gray-500">Loading checklists...</div>
                    ) : checklists.length > 0 ? checklists.map(checklist => {
                      const checklistScopedItems = checklistItems.filter(item => item.checklist_id === checklist.id);
                      const unassignedItems = checklistScopedItems.filter(item => item.milestone_id === null);
                      const milestoneGroups = milestones.map(milestone => ({
                        key: milestone.id,
                        title: milestone.name,
                        expanded: expandedGroups[milestone.id] ?? false,
                        items: checklistScopedItems.filter(item => item.milestone_id === milestone.id),
                        milestoneId: milestone.id,
                      }));
                      const groups = [
                        ...milestoneGroups,
                        {
                          key: 'unassigned',
                          title: 'Unassigned',
                          expanded: expandedGroups.unassigned ?? true,
                          items: unassignedItems,
                          milestoneId: null,
                        },
                      ].filter(group => group.items.length > 0 || group.milestoneId === null);

                      return (
                        <div key={checklist.id} className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
                          <input
                            defaultValue={checklist.name}
                            onBlur={event => {
                              const value = event.target.value.trim();
                              if (value && value !== checklist.name) void handleRenameChecklist(checklist.id, value);
                            }}
                            className="mb-4 w-full bg-transparent text-base font-medium text-white outline-none"
                          />
                          <div className="space-y-3">
                            {groups.map(group => {
                              const progress = getChecklistProgress(group.items);
                              const expanded = group.expanded;
                              return (
                                <div key={`${checklist.id}:${group.key}`} className="rounded-xl border border-gray-800 bg-gray-900">
                                  <button
                                    onClick={() => setExpandedGroups(current => ({ ...current, [group.key]: !expanded }))}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                                  >
                                    <span className="flex items-center gap-2 text-sm text-gray-200">
                                      {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                      {group.title}
                                    </span>
                                    <span className="text-xs text-gray-500">{progress.done}/{progress.total}</span>
                                  </button>
                                  {expanded && (
                                    <div className="space-y-2 border-t border-gray-800 px-3 py-3">
                                      {group.items.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-2 py-2">
                                          <button onClick={() => handleToggleChecklistItem(item)} className="text-gray-300 hover:text-white">
                                            {item.done ? <CheckCircle2 size={17} className="text-emerald-400" /> : <Check size={17} />}
                                          </button>
                                          <input
                                            defaultValue={item.text}
                                            onBlur={event => {
                                              const value = event.target.value.trim();
                                              if (value && value !== item.text) void handleUpdateChecklistItem(item.id, { text: value });
                                            }}
                                            onKeyDown={event => {
                                              if (event.key === 'Backspace' && event.currentTarget.value === '') {
                                                event.preventDefault();
                                                void handleDeleteChecklistItem(item);
                                              }
                                            }}
                                            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                                          />
                                          {item.milestone_id && (
                                            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">
                                              {milestones.find(milestone => milestone.id === item.milestone_id)?.name ?? 'Milestone'}
                                            </span>
                                          )}
                                          <AssigneeBadge assignee={getItemAssignee(item)} membersById={membersById} agentsById={agentsById} />
                                          <select
                                            value={item.assignee_id ? `${item.assignee_type}:${item.assignee_id}` : ''}
                                            onChange={event => {
                                              const value = event.target.value;
                                              if (!value) {
                                                void handleUpdateChecklistItem(item.id, { assignee_id: null, assignee_type: null });
                                                return;
                                              }
                                              const [assigneeType, assigneeId] = value.split(':');
                                              void handleUpdateChecklistItem(item.id, {
                                                assignee_type: assigneeType as 'member' | 'agent',
                                                assignee_id: assigneeId,
                                              });
                                            }}
                                            className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 outline-none"
                                          >
                                            <option value="">Unassigned</option>
                                            {cardMembers.map(member => (
                                              <option key={`member:${member.id}`} value={`member:${member.id}`}>
                                                {member.name}
                                              </option>
                                            ))}
                                            {cardAgents.map(agent => (
                                              <option key={`agent:${agent.id}`} value={`agent:${agent.id}`}>
                                                {agent.name}
                                              </option>
                                            ))}
                                          </select>
                                          <button onClick={() => handleDeleteChecklistItem(item)} className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-red-300">
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex gap-2">
                                        <input
                                          value={newChecklistItems[`${checklist.id}:${group.milestoneId ?? 'unassigned'}`] ?? ''}
                                          onChange={event => setNewChecklistItems(current => ({
                                            ...current,
                                            [`${checklist.id}:${group.milestoneId ?? 'unassigned'}`]: event.target.value,
                                          }))}
                                          onKeyDown={event => {
                                            if (event.key === 'Enter') {
                                              event.preventDefault();
                                              void handleAddChecklistItem(checklist.id, group.milestoneId);
                                            }
                                          }}
                                          placeholder={`Add item to ${group.title}`}
                                          className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                        />
                                        <button
                                          onClick={() => handleAddChecklistItem(checklist.id, group.milestoneId)}
                                          className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:border-gray-600"
                                        >
                                          <Plus size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 text-sm text-gray-500">
                        No checklist yet. Add Checklist above.
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        value={newChecklistName}
                        onChange={event => setNewChecklistName(event.target.value)}
                        placeholder="New checklist"
                        className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddChecklist}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="min-h-0 overflow-y-auto bg-gray-950/80">
              <div className="space-y-4 px-4 py-5 md:px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Comments and activity</h2>
                    <p className="text-xs text-gray-500">Newest first</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-gray-800 bg-gray-900 p-1 text-xs">
                    <button
                      onClick={() => setActivityFilter('all')}
                      className={`rounded-lg px-2 py-1 ${activityFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setActivityFilter('comments')}
                      className={`rounded-lg px-2 py-1 ${activityFilter === 'comments' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                    >
                      Comments only
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-3">
                  <textarea
                    value={commentInput}
                    onChange={event => setCommentInput(event.target.value)}
                    onKeyDown={event => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        void handleCommentSubmit();
                      }
                    }}
                    rows={3}
                    placeholder="Write a comment..."
                    className="w-full resize-none bg-transparent text-sm text-white outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[11px] text-gray-500">Ctrl/Cmd+Enter to submit</div>
                    <button
                      onClick={handleCommentSubmit}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Comment
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {visibleCommentsAndActivity.length > 0 ? visibleCommentsAndActivity.map(entry => {
                    if (entry.type === 'comment') {
                      const comment = entry.item;
                      const isOwn = comment.author_id === user?.id;
                      const authorLabel = isOwn ? (userName ?? 'You') : 'User';
                      const absoluteTime = format(new Date(comment.created_at), 'MMM d, yyyy h:mm a');

                      return (
                        <div key={comment.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-3">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                                {getInitials(authorLabel)}
                              </span>
                              <div>
                                <div className="text-sm font-medium text-white">{authorLabel}</div>
                                <div title={absoluteTime} className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                  {comment.edited ? ' (edited)' : ''}
                                </div>
                              </div>
                            </div>
                            {isOwn && (
                              <div className="flex items-center gap-2 text-xs">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    setEditingCommentBody(comment.body);
                                  }}
                                  className="text-gray-400 hover:text-white"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleCommentDelete(comment.id)}
                                  className="text-red-300 hover:text-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {editingCommentId === comment.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingCommentBody}
                                onChange={event => setEditingCommentBody(event.target.value)}
                                rows={3}
                                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCommentEdit(comment.id)}
                                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditingCommentBody('');
                                  }}
                                  className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:border-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm leading-6 text-gray-200 whitespace-pre-wrap">{comment.body}</p>
                          )}
                        </div>
                      );
                    }

                    const event = entry.item;
                    const absoluteTime = format(new Date(event.created_at), 'MMM d, yyyy h:mm a');

                    return (
                      <div key={event.id} className="flex items-start gap-2 rounded-xl border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm text-gray-400">
                        <MessageSquare size={14} className="mt-0.5 text-gray-500" />
                        <div>
                          <div>{event.event_type.replaceAll('_', ' ')}</div>
                          <div title={absoluteTime} className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-sm text-gray-500">
                      No comments or activity yet.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
              <h3 className="text-lg font-semibold text-white">Delete this card?</h3>
              <p className="mt-2 text-sm text-gray-400">This can be undone.</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleDeleteCard}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
