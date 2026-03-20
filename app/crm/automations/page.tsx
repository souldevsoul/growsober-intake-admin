'use client';

import { useEffect, useState } from 'react';
import { getAutomations, createAutomation, updateAutomation, deleteAutomation, getAutomationAnalytics } from '@/lib/api';
import type { CrmAutomation, AutomationAnalytics } from '@/lib/api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TRIGGERS = [
  'LEAD_MATCHED',
  'COHORT_CREATED',
  'COHORT_INVITED',
  'RSVP_CONFIRMED',
  'RSVP_DECLINED',
  'RSVP_CANCELLED',
  'HOURS_BEFORE_EVENT',
  'EVENT_COMPLETED',
  'ADDED_TO_WAITLIST',
] as const;

const CHANNELS = ['SMS', 'PUSH'] as const;

const TRIGGER_COLORS: Record<string, string> = {
  COHORT_INVITED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  RSVP_CONFIRMED: 'bg-green-500/20 text-green-300 border-green-500/30',
  RSVP_DECLINED: 'bg-red-500/20 text-red-300 border-red-500/30',
  HOURS_BEFORE_EVENT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  EVENT_COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const CHANNEL_COLORS: Record<string, string> = {
  SMS: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  PUSH: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const DEFAULT_TRIGGER_COLOR = 'bg-gray-500/20 text-white/60 border-gray-500/30';

function HighlightedTemplate({ text }: { text: string }) {
  const parts = text.split(/({{[^}]+}})/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('{{') ? (
          <span key={i} className="text-amber-400 font-semibold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function getDeliveryRateColor(rate: number): string {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function getDeliveryRateBorder(rate: number): string {
  if (rate >= 90) return 'border-green-500/30';
  if (rate >= 70) return 'border-yellow-500/30';
  return 'border-red-500/30';
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<CrmAutomation[]>([]);
  const [analytics, setAnalytics] = useState<AutomationAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState<string>('COHORT_INVITED');
  const [newChannel, setNewChannel] = useState<string>('SMS');
  const [newTemplate, setNewTemplate] = useState('');
  const [newHoursBefore, setNewHoursBefore] = useState(24);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editTemplate, setEditTemplate] = useState('');

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const data = await getAutomations();
      setAutomations(data);
    } catch (err) {
      console.error('Failed to fetch automations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await getAutomationAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch automation analytics:', err);
    }
  };

  useEffect(() => {
    fetchAutomations();
    fetchAnalytics();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newTemplate.trim()) return;
    try {
      const dto: Parameters<typeof createAutomation>[0] = {
        name: newName.trim(),
        trigger: newTrigger,
        channel: newChannel,
        messageTemplate: newTemplate,
      };
      if (newTrigger === 'HOURS_BEFORE_EVENT') {
        dto.triggerConfig = { hoursBefore: newHoursBefore };
      }
      await createAutomation(dto);
      setNewName('');
      setNewTrigger('COHORT_INVITED');
      setNewChannel('SMS');
      setNewTemplate('');
      setNewHoursBefore(24);
      setShowCreate(false);
      fetchAutomations();
    } catch (err) {
      console.error('Failed to create automation:', err);
    }
  };

  const handleToggleActive = async (auto: CrmAutomation) => {
    try {
      await updateAutomation(auto.id, { isActive: !auto.isActive });
      fetchAutomations();
    } catch (err) {
      console.error('Failed to toggle automation:', err);
    }
  };

  const handleStartEdit = (auto: CrmAutomation) => {
    setEditingId(auto.id);
    setEditName(auto.name);
    setEditTemplate(auto.messageTemplate);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateAutomation(id, {
        name: editName.trim(),
        messageTemplate: editTemplate,
      });
      setEditingId(null);
      fetchAutomations();
    } catch (err) {
      console.error('Failed to update automation:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this automation? This cannot be undone.')) return;
    try {
      await deleteAutomation(id);
      fetchAutomations();
    } catch (err) {
      console.error('Failed to delete automation:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Automations</h1>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'Add Automation'}
          </Button>
        </div>

        {/* Analytics Summary */}
        {analytics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {analytics.map((a) => (
              <Card key={a.id} className={`neon-card border ${getDeliveryRateBorder(a.deliveryRate)}`}>
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/30 uppercase tracking-wider">Total Sent</span>
                    <span className="text-sm font-medium mono-num">{a.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/30 uppercase tracking-wider">Delivery Rate</span>
                    <span className={`text-sm font-bold mono-num ${getDeliveryRateColor(a.deliveryRate)}`}>
                      {a.deliveryRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="text-green-400 mono-num">{a.sent} sent</span>
                    <span className="text-red-400 mono-num">{a.failed} failed</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">New Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. RSVP Confirmation SMS"
                    className="bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Trigger</label>
                  <Select value={newTrigger} onValueChange={setNewTrigger}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.12] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/[0.15]">
                      {TRIGGERS.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Channel</label>
                  <Select value={newChannel} onValueChange={setNewChannel}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.12] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/[0.15]">
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newTrigger === 'HOURS_BEFORE_EVENT' && (
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Hours before event</label>
                  <Input
                    type="number"
                    min={1}
                    value={newHoursBefore}
                    onChange={(e) => setNewHoursBefore(Number(e.target.value))}
                    className="bg-white/[0.04] border-white/[0.12] text-white w-32"
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-white/40 mb-1 block">Message Template</label>
                <textarea
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder="Hey {{name}}, your event is coming up..."
                  rows={4}
                  className="w-full bg-white/[0.04] border border-white/[0.12] text-white rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-white/30 mt-1">
                  Available: {'{{name}} {{city}} {{cohort_name}} {{cohort_members}} {{event_date}} {{event_location}} {{event_notes}}'}
                </p>
              </div>

              <Button onClick={handleCreate} disabled={!newName.trim() || !newTemplate.trim()}>
                Create
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Automations List */}
        {loading ? (
          <p className="text-white/30 text-center py-8">Loading...</p>
        ) : automations.length === 0 ? (
          <p className="text-white/30 text-center py-8">No automations yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {automations.map((auto) => (
              <Card key={auto.id} className="neon-card">
                <CardContent className="p-4">
                  {editingId === auto.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-white/40 mb-1 block">Name</label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-white/[0.04] border-white/[0.12] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/40 mb-1 block">Message Template</label>
                        <textarea
                          value={editTemplate}
                          onChange={(e) => setEditTemplate(e.target.value)}
                          rows={4}
                          className="w-full bg-white/[0.04] border border-white/[0.12] text-white rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(auto.id)}>Save</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-transparent border-white/[0.12] text-white/60 hover:bg-white/[0.06] hover:text-white"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white text-lg">{auto.name}</h3>
                          <Badge variant="outline" className={`uppercase tracking-wider text-xs font-semibold ${TRIGGER_COLORS[auto.trigger] || DEFAULT_TRIGGER_COLOR}`}>
                            {auto.trigger.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline" className={`uppercase tracking-wider text-xs font-semibold ${CHANNEL_COLORS[auto.channel] || DEFAULT_TRIGGER_COLOR}`}>
                            {auto.channel}
                          </Badge>
                          {auto._count && (
                            <span className="text-xs text-white/30 mono-num">Sent {auto._count.logs} time{auto._count.logs !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(auto)}
                            className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider transition-colors ${
                              auto.isActive
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.06]'
                            }`}
                          >
                            {auto.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent border-white/[0.12] text-white/60 hover:bg-white/[0.06] hover:text-white"
                            onClick={() => handleStartEdit(auto)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                            onClick={() => handleDelete(auto.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      {auto.trigger === 'HOURS_BEFORE_EVENT' && auto.triggerConfig && (
                        <p className="text-sm text-white/40">
                          {(auto.triggerConfig as { hoursBefore?: number }).hoursBefore ?? '?'} hours before event
                        </p>
                      )}

                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 font-mono text-sm text-white/60">
                        <HighlightedTemplate text={auto.messageTemplate} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
