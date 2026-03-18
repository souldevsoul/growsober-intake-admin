'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { getSequences, createSequence, updateSequence } from '@/lib/api';
import type { DripSequence } from '@/lib/api';
import { TRIGGER_LABELS } from '@/lib/constants';

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

export default function SequencesPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState<DripSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrigger, setNewTrigger] = useState('MANUAL');
  const [newTriggerValue, setNewTriggerValue] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const data = await getSequences();
      setSequences(data);
    } catch (err) {
      console.error('Failed to fetch sequences:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createSequence({
        name: newName.trim(),
        trigger: newTrigger,
        triggerValue: newTriggerValue || undefined,
        description: newDesc || undefined,
      });
      setNewName('');
      setNewTrigger('MANUAL');
      setNewTriggerValue('');
      setNewDesc('');
      setShowCreate(false);
      fetchSequences();
    } catch (err) {
      console.error('Failed to create sequence:', err);
    }
  };

  const handleToggleActive = async (seq: DripSequence) => {
    try {
      await updateSequence(seq.id, { isActive: !seq.isActive });
      fetchSequences();
    } catch (err) {
      console.error('Failed to toggle sequence:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Drip Sequences</h1>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'New Sequence'}
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">Create Sequence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Founding Crew Welcome"
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
                      <SelectItem value="MANUAL">Manual</SelectItem>
                      <SelectItem value="ON_LEAD_CREATED">On Lead Created</SelectItem>
                      <SelectItem value="ON_STATUS_CHANGE">On Status Change</SelectItem>
                      <SelectItem value="ON_TAG_ADDED">On Tag Added</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(newTrigger === 'ON_STATUS_CHANGE' || newTrigger === 'ON_TAG_ADDED') && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    {newTrigger === 'ON_STATUS_CHANGE' ? 'Status Value' : 'Tag Value'}
                  </label>
                  <Input
                    value={newTriggerValue}
                    onChange={(e) => setNewTriggerValue(e.target.value)}
                    placeholder={newTrigger === 'ON_STATUS_CHANGE' ? 'e.g. INFO_COLLECTED' : 'e.g. founding-crew'}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description (optional)</label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What this sequence does..."
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                Create
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sequences List */}
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : sequences.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No sequences yet. Create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {sequences.map((seq) => (
              <Card
                key={seq.id}
                className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => router.push(`/crm/sequences/${seq.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{seq.name}</h3>
                        {seq.description && (
                          <p className="text-sm text-gray-400 mt-0.5">{seq.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                        {TRIGGER_LABELS[seq.trigger] || seq.trigger}
                      </Badge>
                      <span className="text-gray-400">{seq.steps.length} steps</span>
                      <span className="text-gray-400">{seq._count.enrollments} enrolled</span>
                      <span className="text-gray-500">
                        {formatDistanceToNow(new Date(seq.createdAt), { addSuffix: true })}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(seq); }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          seq.isActive
                            ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {seq.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
