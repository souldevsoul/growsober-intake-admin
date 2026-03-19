'use client';

import { useEffect, useState } from 'react';
import { getAutomations, createAutomation, updateAutomation, deleteAutomation } from '@/lib/api';
import type { CrmAutomation } from '@/lib/api';

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

const DEFAULT_TRIGGER_COLOR = 'bg-gray-500/20 text-gray-300 border-gray-500/30';

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

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<CrmAutomation[]>([]);
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

  useEffect(() => {
    fetchAutomations();
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
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Automations</h1>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'Add Automation'}
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">New Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. RSVP Confirmation SMS"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Trigger</label>
                  <Select value={newTrigger} onValueChange={setNewTrigger}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      {TRIGGERS.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Channel</label>
                  <Select value={newChannel} onValueChange={setNewChannel}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newTrigger === 'HOURS_BEFORE_EVENT' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Hours before event</label>
                  <Input
                    type="number"
                    min={1}
                    value={newHoursBefore}
                    onChange={(e) => setNewHoursBefore(Number(e.target.value))}
                    className="bg-gray-800 border-gray-700 text-white w-32"
                  />
                </div>
              )}

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Message Template</label>
                <textarea
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  placeholder="Hey {{name}}, your event is coming up..."
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
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
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : automations.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No automations yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {automations.map((auto) => (
              <Card key={auto.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  {editingId === auto.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">Name</label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-400 mb-1 block">Message Template</label>
                        <textarea
                          value={editTemplate}
                          onChange={(e) => setEditTemplate(e.target.value)}
                          rows={4}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(auto.id)}>Save</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
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
                          <Badge variant="outline" className={TRIGGER_COLORS[auto.trigger] || DEFAULT_TRIGGER_COLOR}>
                            {auto.trigger.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant="outline" className={CHANNEL_COLORS[auto.channel] || DEFAULT_TRIGGER_COLOR}>
                            {auto.channel}
                          </Badge>
                          {auto._count && (
                            <span className="text-xs text-gray-500">Sent {auto._count.logs} time{auto._count.logs !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(auto)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              auto.isActive
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            {auto.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
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
                        <p className="text-sm text-gray-400">
                          {(auto.triggerConfig as { hoursBefore?: number }).hoursBefore ?? '?'} hours before event
                        </p>
                      )}

                      <div className="bg-gray-800/50 border border-gray-700/50 rounded-md px-3 py-2 font-mono text-sm text-gray-300">
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
