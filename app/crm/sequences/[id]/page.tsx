'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import {
  getSequence,
  updateSequence,
  addStep,
  updateStep,
  deleteStep,
  pauseEnrollment,
  resumeEnrollment,
  cancelEnrollment,
} from '@/lib/api';
import type { DripSequenceDetail, DripStep } from '@/lib/api';
import { ENROLLMENT_COLORS, TRIGGER_LABELS } from '@/lib/constants';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediate';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

export default function SequenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sequence, setSequence] = useState<DripSequenceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // New step form
  const [newDelay, setNewDelay] = useState('0');
  const [newChannel, setNewChannel] = useState('SMS');
  const [newContent, setNewContent] = useState('');

  // Edit step
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDelay, setEditDelay] = useState('');

  const fetchSequence = async () => {
    try {
      const data = await getSequence(id);
      setSequence(data);
    } catch (err) {
      console.error('Failed to fetch sequence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchSequence();
  }, [id]);

  const handleAddStep = async () => {
    if (!newContent.trim() || !sequence) return;
    const stepNumber = sequence.steps.length + 1;
    await addStep(id, {
      stepNumber,
      delayMinutes: parseInt(newDelay) || 0,
      channel: newChannel,
      content: newContent.trim(),
    });
    setNewContent('');
    setNewDelay('0');
    fetchSequence();
  };

  const handleUpdateStep = async (stepId: string) => {
    await updateStep(stepId, {
      content: editContent,
      delayMinutes: parseInt(editDelay) || 0,
    });
    setEditingStep(null);
    fetchSequence();
  };

  const handleDeleteStep = async (stepId: string) => {
    await deleteStep(stepId);
    fetchSequence();
  };

  const handleToggleActive = async () => {
    if (!sequence) return;
    await updateSequence(id, { isActive: !sequence.isActive });
    fetchSequence();
  };

  const handleEnrollmentAction = async (enrollmentId: string, action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'pause') await pauseEnrollment(enrollmentId);
    else if (action === 'resume') await resumeEnrollment(enrollmentId);
    else await cancelEnrollment(enrollmentId);
    fetchSequence();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white p-6"><p className="text-gray-500">Loading...</p></div>;
  if (!sequence) return <div className="min-h-screen bg-gray-950 text-white p-6"><p className="text-gray-500">Sequence not found</p></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/crm/sequences')}
            className="text-gray-400"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{sequence.name}</h1>
            {sequence.description && (
              <p className="text-gray-400 mt-1">{sequence.description}</p>
            )}
          </div>
          <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            {TRIGGER_LABELS[sequence.trigger] || sequence.trigger}
            {sequence.triggerValue && `: ${sequence.triggerValue}`}
          </Badge>
          <button
            onClick={handleToggleActive}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              sequence.isActive
                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {sequence.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>

        {/* Steps */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">Steps ({sequence.steps.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sequence.steps.map((step) => (
              <div
                key={step.id}
                className="flex items-start gap-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
              >
                <div className="flex items-center gap-2 shrink-0 pt-1">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-bold">
                    {step.stepNumber}
                  </span>
                  <Badge variant="outline" className="text-xs bg-gray-700/50 text-gray-300 border-gray-600">
                    {formatDelay(step.delayMinutes)}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-gray-700/50 text-gray-300 border-gray-600">
                    {step.channel}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  {editingStep === step.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white resize-none"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400">Delay (min):</label>
                        <Input
                          value={editDelay}
                          onChange={(e) => setEditDelay(e.target.value)}
                          className="w-24 h-7 bg-gray-900 border-gray-700 text-white text-xs"
                          type="number"
                        />
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdateStep(step.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400" onClick={() => setEditingStep(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{step.content}</p>
                  )}
                </div>
                {editingStep !== step.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-gray-400"
                      onClick={() => {
                        setEditingStep(step.id);
                        setEditContent(step.content);
                        setEditDelay(String(step.delayMinutes));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteStep(step.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Add Step */}
            <div className="p-3 rounded-lg border border-dashed border-gray-700 space-y-3">
              <p className="text-sm text-gray-400 font-medium">Add Step</p>
              <div className="flex gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Delay (minutes)</label>
                  <Input
                    value={newDelay}
                    onChange={(e) => setNewDelay(e.target.value)}
                    type="number"
                    className="w-28 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Channel</label>
                  <Select value={newChannel} onValueChange={setNewChannel}>
                    <SelectTrigger className="w-24 bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Content (use {'{{name}}'}, {'{{city}}'}, {'{{interests}}'} placeholders)
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Hey {{name}}! Welcome to the founding crew..."
                  className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white resize-none placeholder:text-gray-500"
                  rows={3}
                />
              </div>
              <Button onClick={handleAddStep} disabled={!newContent.trim()}>
                Add Step
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Enrollments */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">
              Enrollments ({sequence.enrollments?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Name</TableHead>
                  <TableHead className="text-gray-400">Phone</TableHead>
                  <TableHead className="text-gray-400">Step</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Enrolled</TableHead>
                  <TableHead className="text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!sequence.enrollments?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                      No enrollments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sequence.enrollments.map((e) => (
                    <TableRow key={e.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="font-medium">{e.lead.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{e.lead.phone}</TableCell>
                      <TableCell>
                        {e.currentStep} / {sequence.steps.length}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ENROLLMENT_COLORS[e.status] || ''}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {e.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-yellow-400"
                              onClick={() => handleEnrollmentAction(e.id, 'pause')}
                            >
                              Pause
                            </Button>
                          )}
                          {e.status === 'PAUSED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-blue-400"
                              onClick={() => handleEnrollmentAction(e.id, 'resume')}
                            >
                              Resume
                            </Button>
                          )}
                          {(e.status === 'ACTIVE' || e.status === 'PAUSED') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-400"
                              onClick={() => handleEnrollmentAction(e.id, 'cancel')}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
