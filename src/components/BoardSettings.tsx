'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, Check, Pencil, Tags, Users, X } from 'lucide-react';
import type { Agent, Member } from '@/types';
import { useApp } from '@/context/AppContext';

const REGISTRY_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

type SettingsTab = 'tags' | 'members' | 'agents';

interface BoardSettingsProps {
  boardId: string;
  boardName: string;
  open: boolean;
  onClose: () => void;
}

interface MemberFormState {
  name: string;
  email: string;
  color: string;
}

interface AgentFormState {
  name: string;
  description: string;
  color: string;
}

const createMemberFormState = (): MemberFormState => ({
  name: '',
  email: '',
  color: REGISTRY_COLORS[0],
});

const createAgentFormState = (): AgentFormState => ({
  name: '',
  description: '',
  color: REGISTRY_COLORS[0],
});

function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REGISTRY_COLORS.map(option => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${
            color === option ? 'border-white' : 'border-transparent'
          }`}
          aria-label={`Select ${option}`}
        >
          <span className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: option }} />
        </button>
      ))}
    </div>
  );
}

export function BoardSettings({ boardId, boardName, open, onClose }: BoardSettingsProps) {
  const {
    tags,
    members,
    agents,
    createTag,
    deleteTag,
    createMember,
    updateMember,
    deleteMember,
    createAgent,
    updateAgent,
    deleteAgent,
  } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('tags');
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(REGISTRY_COLORS[0]);
  const [memberForm, setMemberForm] = useState<MemberFormState>(createMemberFormState);
  const [agentForm, setAgentForm] = useState<AgentFormState>(createAgentFormState);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<MemberFormState>(createMemberFormState);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentFormState>(createAgentFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const boardTags = useMemo(() => tags.filter(tag => tag.board_id === boardId), [boardId, tags]);
  const boardMembers = useMemo(() => members.filter(member => member.board_id === boardId), [boardId, members]);
  const boardAgents = useMemo(() => agents.filter(agent => agent.board_id === boardId), [agents, boardId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setActiveTab('tags');
      setTagName('');
      setTagColor(REGISTRY_COLORS[0]);
      setMemberForm(createMemberFormState());
      setAgentForm(createAgentFormState());
      setEditingMemberId(null);
      setEditingMember(createMemberFormState());
      setEditingAgentId(null);
      setEditingAgent(createAgentFormState());
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleCreateTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = tagName.trim();
    if (!trimmedName || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await createTag(boardId, trimmedName, tagColor);
    setTagName('');
    setTagColor(REGISTRY_COLORS[0]);
    setIsSubmitting(false);
  };

  const handleDeleteTag = async (tagId: string) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await deleteTag(tagId);
    setIsSubmitting(false);
  };

  const handleCreateMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = memberForm.name.trim();
    const trimmedEmail = memberForm.email.trim();
    if (!trimmedName || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const created = await createMember(boardId, trimmedName, trimmedEmail || null, memberForm.color);
    if (created) {
      setMemberForm(createMemberFormState());
    }
    setIsSubmitting(false);
  };

  const handleStartMemberEdit = (member: Member) => {
    setEditingMemberId(member.id);
    setEditingMember({
      name: member.name,
      email: member.email ?? '',
      color: member.color,
    });
  };

  const handleSaveMember = async () => {
    const trimmedName = editingMember.name.trim();
    const trimmedEmail = editingMember.email.trim();
    if (!editingMemberId || !trimmedName || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const updated = await updateMember(editingMemberId, {
      name: trimmedName,
      email: trimmedEmail || null,
      color: editingMember.color,
    });
    if (updated) {
      setEditingMemberId(null);
      setEditingMember(createMemberFormState());
    }
    setIsSubmitting(false);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await deleteMember(memberId);
    if (editingMemberId === memberId) {
      setEditingMemberId(null);
      setEditingMember(createMemberFormState());
    }
    setIsSubmitting(false);
  };

  const handleCreateAgent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = agentForm.name.trim();
    const trimmedDescription = agentForm.description.trim();
    if (!trimmedName || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const created = await createAgent(boardId, trimmedName, trimmedDescription || null, agentForm.color);
    if (created) {
      setAgentForm(createAgentFormState());
    }
    setIsSubmitting(false);
  };

  const handleStartAgentEdit = (agent: Agent) => {
    setEditingAgentId(agent.id);
    setEditingAgent({
      name: agent.name,
      description: agent.description ?? '',
      color: agent.color,
    });
  };

  const handleSaveAgent = async () => {
    const trimmedName = editingAgent.name.trim();
    const trimmedDescription = editingAgent.description.trim();
    if (!editingAgentId || !trimmedName || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const updated = await updateAgent(editingAgentId, {
      name: trimmedName,
      description: trimmedDescription || null,
      color: editingAgent.color,
    });
    if (updated) {
      setEditingAgentId(null);
      setEditingAgent(createAgentFormState());
    }
    setIsSubmitting(false);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    await deleteAgent(agentId);
    if (editingAgentId === agentId) {
      setEditingAgentId(null);
      setEditingAgent(createAgentFormState());
    }
    setIsSubmitting(false);
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Tags }> = [
    { id: 'tags', label: 'Tags', icon: Tags },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'agents', label: 'Agents', icon: Bot },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Board Settings</h2>
            <p className="text-sm text-gray-400">{boardName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Close board settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <aside className="border-b border-gray-700 md:w-52 md:border-b-0 md:border-r">
            <nav className="flex gap-2 p-3 md:flex-col">
              {tabs.map(tab => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="flex-1 overflow-y-auto p-6">
            {activeTab === 'tags' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Tags</h3>
                  <p className="mt-1 text-sm text-gray-400">Manage reusable board tags and colors for cards on this board.</p>
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-800/60">
                  <div className="border-b border-gray-700 px-4 py-3">
                    <h4 className="text-sm font-semibold text-white">Current Tags</h4>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {boardTags.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-400">No tags yet. Add your first tag below.</div>
                    ) : (
                      boardTags.map(tag => (
                        <div key={tag.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: tag.color }} />
                            <span className="text-sm font-medium text-gray-100">{tag.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTag(tag.id)}
                            className="text-sm text-red-300 transition-colors hover:text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleCreateTag} className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Add Tag</h4>
                    <p className="mt-1 text-sm text-gray-400">Choose a label and color, then save it to this board.</p>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-gray-200">Name</span>
                    <input
                      value={tagName}
                      onChange={event => setTagName(event.target.value)}
                      placeholder="Design, Blocked, Backend..."
                      className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-200">Color</span>
                    <ColorPicker color={tagColor} onChange={setTagColor} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: tagColor }} />
                      Preview
                    </div>
                    <button
                      type="submit"
                      disabled={!tagName.trim() || isSubmitting}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/50"
                    >
                      Add Tag
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Members</h3>
                  <p className="mt-1 text-sm text-gray-400">Keep a board-specific registry of people who can be assigned and referenced later.</p>
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-800/60">
                  <div className="border-b border-gray-700 px-4 py-3">
                    <h4 className="text-sm font-semibold text-white">Current Members</h4>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {boardMembers.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-400">No members yet. Add the people who work on this board below.</div>
                    ) : (
                      boardMembers.map(member => (
                        <div key={member.id} className="px-4 py-4">
                          {editingMemberId === member.id ? (
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block space-y-2">
                                  <span className="text-sm font-medium text-gray-200">Name</span>
                                  <input
                                    value={editingMember.name}
                                    onChange={event => setEditingMember(prev => ({ ...prev, name: event.target.value }))}
                                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                                  />
                                </label>
                                <label className="block space-y-2">
                                  <span className="text-sm font-medium text-gray-200">Email</span>
                                  <input
                                    value={editingMember.email}
                                    onChange={event => setEditingMember(prev => ({ ...prev, email: event.target.value }))}
                                    placeholder="name@company.com"
                                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                                  />
                                </label>
                              </div>

                              <div className="space-y-2">
                                <span className="text-sm font-medium text-gray-200">Color</span>
                                <ColorPicker color={editingMember.color} onChange={color => setEditingMember(prev => ({ ...prev, color }))} />
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMemberId(null);
                                    setEditingMember(createMemberFormState());
                                  }}
                                  className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveMember()}
                                  disabled={!editingMember.name.trim() || isSubmitting}
                                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/50"
                                >
                                  Save Member
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="mt-1 h-3 w-3 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: member.color }} />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-100">{member.name}</div>
                                  <div className="mt-1 text-sm text-gray-400">{member.email || 'No email set'}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleStartMemberEdit(member)}
                                  className="inline-flex items-center gap-1 text-sm text-gray-300 transition-colors hover:text-white"
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteMember(member.id)}
                                  className="text-sm text-red-300 transition-colors hover:text-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleCreateMember} className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Add Member</h4>
                    <p className="mt-1 text-sm text-gray-400">Create a reusable board member entry with an optional email address.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-gray-200">Name</span>
                      <input
                        value={memberForm.name}
                        onChange={event => setMemberForm(prev => ({ ...prev, name: event.target.value }))}
                        placeholder="Jane Doe"
                        className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-gray-200">Email</span>
                      <input
                        value={memberForm.email}
                        onChange={event => setMemberForm(prev => ({ ...prev, email: event.target.value }))}
                        placeholder="jane@company.com"
                        className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-200">Color</span>
                    <ColorPicker color={memberForm.color} onChange={color => setMemberForm(prev => ({ ...prev, color }))} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: memberForm.color }} />
                      Preview
                    </div>
                    <button
                      type="submit"
                      disabled={!memberForm.name.trim() || isSubmitting}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/50"
                    >
                      Add Member
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'agents' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-white">Agents</h3>
                  <p className="mt-1 text-sm text-gray-400">Track board-specific agents with names, descriptions, and registry colors.</p>
                </div>

                <div className="rounded-xl border border-gray-700 bg-gray-800/60">
                  <div className="border-b border-gray-700 px-4 py-3">
                    <h4 className="text-sm font-semibold text-white">Current Agents</h4>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {boardAgents.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-gray-400">No agents yet. Add the agents available on this board below.</div>
                    ) : (
                      boardAgents.map(agent => (
                        <div key={agent.id} className="px-4 py-4">
                          {editingAgentId === agent.id ? (
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block space-y-2">
                                  <span className="text-sm font-medium text-gray-200">Name</span>
                                  <input
                                    value={editingAgent.name}
                                    onChange={event => setEditingAgent(prev => ({ ...prev, name: event.target.value }))}
                                    className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-500"
                                  />
                                </label>
                                <div className="space-y-2">
                                  <span className="text-sm font-medium text-gray-200">Color</span>
                                  <ColorPicker color={editingAgent.color} onChange={color => setEditingAgent(prev => ({ ...prev, color }))} />
                                </div>
                              </div>

                              <label className="block space-y-2">
                                <span className="text-sm font-medium text-gray-200">Description</span>
                                <textarea
                                  value={editingAgent.description}
                                  onChange={event => setEditingAgent(prev => ({ ...prev, description: event.target.value }))}
                                  rows={3}
                                  placeholder="What this agent is for, what it handles, or when to use it."
                                  className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                                />
                              </label>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAgentId(null);
                                    setEditingAgent(createAgentFormState());
                                  }}
                                  className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveAgent()}
                                  disabled={!editingAgent.name.trim() || isSubmitting}
                                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/50"
                                >
                                  Save Agent
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="mt-1 h-3 w-3 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: agent.color }} />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-100">{agent.name}</div>
                                  <div className="mt-1 text-sm text-gray-400">{agent.description || 'No description set'}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleStartAgentEdit(agent)}
                                  className="inline-flex items-center gap-1 text-sm text-gray-300 transition-colors hover:text-white"
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAgent(agent.id)}
                                  className="text-sm text-red-300 transition-colors hover:text-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleCreateAgent} className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Add Agent</h4>
                    <p className="mt-1 text-sm text-gray-400">Register a board agent with an optional description of its role.</p>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-gray-200">Name</span>
                    <input
                      value={agentForm.name}
                      onChange={event => setAgentForm(prev => ({ ...prev, name: event.target.value }))}
                      placeholder="Research Bot"
                      className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-gray-200">Description</span>
                    <textarea
                      value={agentForm.description}
                      onChange={event => setAgentForm(prev => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      placeholder="Summarizes requirements, writes drafts, reviews PRs..."
                      className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-indigo-500"
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-gray-200">Color</span>
                    <ColorPicker color={agentForm.color} onChange={color => setAgentForm(prev => ({ ...prev, color }))} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: agentForm.color }} />
                      Preview
                    </div>
                    <button
                      type="submit"
                      disabled={!agentForm.name.trim() || isSubmitting}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-600/50"
                    >
                      Add Agent
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
