'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  getCohorts,
  generateCohorts,
  confirmCohort,
  sendCohortInvitations,
  createCohortEvent,
  sendCohortReminders,
  completeCohort,
  cancelCohort,
  deleteCohort,
} from '@/lib/api';
import type { Cohort } from '@/lib/api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, HelpCircle, MapPin, Calendar, Users, Loader2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  INVITED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  EVENT_CREATED: 'bg-green-500/20 text-green-300 border-green-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUSES = ['DRAFT', 'CONFIRMED', 'INVITED', 'EVENT_CREATED', 'COMPLETED', 'CANCELLED'] as const;

function RsvpIcon({ status }: { status: string }) {
  if (status === 'CONFIRMED') return <Check className="w-3 h-3 text-green-400" />;
  if (status === 'DECLINED' || status === 'CANCELLED') return <X className="w-3 h-3 text-red-400" />;
  return <HelpCircle className="w-3 h-3 text-gray-500" />;
}

export default function CohortsPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateCity, setGenerateCity] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirm form state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState('');
  const [confirmLocation, setConfirmLocation] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const result = await getCohorts(params);
      setCohorts(result.data || []);
      setTotal(result.meta?.total || 0);
    } catch (err) {
      console.error('Failed to fetch cohorts:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const params = generateCity.trim() ? { city: generateCity.trim() } : undefined;
      await generateCohorts(params);
      setShowGenerateForm(false);
      setGenerateCity('');
      fetchData();
    } catch (err) {
      console.error('Failed to generate cohorts:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async (id: string) => {
    if (!confirmDate) return;
    setActionLoading(id);
    try {
      await confirmCohort(id, {
        eventDate: new Date(confirmDate).toISOString(),
        eventLocation: confirmLocation || undefined,
        eventNotes: confirmNotes || undefined,
      });
      setConfirmingId(null);
      setConfirmDate('');
      setConfirmLocation('');
      setConfirmNotes('');
      fetchData();
    } catch (err) {
      console.error('Failed to confirm cohort:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (id: string, action: () => Promise<unknown>) => {
    setActionLoading(id);
    try {
      await action();
      fetchData();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Cohorts</h1>
            <Badge variant="secondary" className="bg-gray-800 text-gray-300">
              {total}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-gray-900 border-gray-800 text-white w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowGenerateForm(!showGenerateForm)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Generate Cohorts
            </Button>
          </div>
        </div>

        {/* Generate Form */}
        {showGenerateForm && (
          <div className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <Input
              placeholder="City filter (optional)"
              value={generateCity}
              onChange={(e) => setGenerateCity(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white max-w-xs"
            />
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setShowGenerateForm(false); setGenerateCity(''); }}
              className="text-gray-400"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Cohort Cards */}
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : cohorts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No cohorts found. Generate some to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {cohorts.map((cohort) => (
              <div
                key={cohort.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => router.push(`/crm/cohorts/${cohort.id}`)}
              >
                <div className="flex items-start justify-between">
                  {/* Left side: info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    {/* Name + City + Status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-white text-lg">{cohort.name}</h3>
                      {cohort.city && (
                        <span className="text-sm text-gray-400">{cohort.city}</span>
                      )}
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[cohort.status] || ''}
                      >
                        {cohort.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Member count + event info */}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {cohort.members?.length || 0} members
                      </span>
                      {cohort.eventDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(cohort.eventDate), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      {cohort.eventLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {cohort.eventLocation}
                        </span>
                      )}
                    </div>

                    {/* Member pills */}
                    {cohort.members && cohort.members.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {cohort.members.map((member) => (
                          <span
                            key={member.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-300"
                          >
                            {member.lead?.name || 'Unknown'}
                            <RsvpIcon status={member.rsvpStatus} />
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inline confirm form */}
                    {confirmingId === cohort.id && (
                      <div
                        className="flex items-end gap-3 mt-2 p-3 bg-gray-800 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Event Date *
                          </label>
                          <Input
                            type="datetime-local"
                            value={confirmDate}
                            onChange={(e) => setConfirmDate(e.target.value)}
                            className="bg-gray-700 border-gray-600 text-white w-52"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Location
                          </label>
                          <Input
                            value={confirmLocation}
                            onChange={(e) => setConfirmLocation(e.target.value)}
                            placeholder="e.g. Coffee shop on Main St"
                            className="bg-gray-700 border-gray-600 text-white w-56"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Notes
                          </label>
                          <Input
                            value={confirmNotes}
                            onChange={(e) => setConfirmNotes(e.target.value)}
                            placeholder="Optional notes"
                            className="bg-gray-700 border-gray-600 text-white w-48"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(cohort.id)}
                          disabled={!confirmDate || actionLoading === cohort.id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {actionLoading === cohort.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmingId(null);
                            setConfirmDate('');
                            setConfirmLocation('');
                            setConfirmNotes('');
                          }}
                          className="text-gray-400"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Right side: action buttons */}
                  <div
                    className="flex items-center gap-2 ml-4 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cohort.status === 'DRAFT' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setConfirmingId(cohort.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={actionLoading === cohort.id}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(cohort.id, () => deleteCohort(cohort.id))
                          }
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          disabled={actionLoading === cohort.id}
                        >
                          Delete
                        </Button>
                      </>
                    )}

                    {cohort.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleAction(cohort.id, () =>
                            sendCohortInvitations(cohort.id)
                          )
                        }
                        className="bg-yellow-600 hover:bg-yellow-700"
                        disabled={actionLoading === cohort.id}
                      >
                        {actionLoading === cohort.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Send Invitations'
                        )}
                      </Button>
                    )}

                    {cohort.status === 'INVITED' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAction(cohort.id, () =>
                              createCohortEvent(cohort.id)
                            )
                          }
                          className="bg-green-600 hover:bg-green-700"
                          disabled={actionLoading === cohort.id}
                        >
                          Create Event
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(cohort.id, () =>
                              sendCohortReminders(cohort.id)
                            )
                          }
                          className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          disabled={actionLoading === cohort.id}
                        >
                          Send Reminders
                        </Button>
                      </>
                    )}

                    {cohort.status === 'EVENT_CREATED' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAction(cohort.id, () =>
                              completeCohort(cohort.id)
                            )
                          }
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={actionLoading === cohort.id}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(cohort.id, () =>
                              sendCohortReminders(cohort.id)
                            )
                          }
                          className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          disabled={actionLoading === cohort.id}
                        >
                          Send Reminders
                        </Button>
                      </>
                    )}

                    {cohort.status !== 'COMPLETED' && cohort.status !== 'CANCELLED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleAction(cohort.id, () => cancelCohort(cohort.id))
                        }
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        disabled={actionLoading === cohort.id}
                      >
                        Cancel
                      </Button>
                    )}

                    {actionLoading === cohort.id && cohort.status !== 'DRAFT' && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
