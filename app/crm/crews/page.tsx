'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  getCrews,
  generateCrews,
  confirmCrew,
  sendCrewInvitations,
  createCrewEvent,
  sendCrewReminders,
  completeCrew,
  cancelCrew,
  deleteCrew,
} from '@/lib/api';
import type { Crew } from '@/lib/api';

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
  DRAFT: 'bg-gray-500/20 text-white/60 border-gray-500/30',
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
  return <HelpCircle className="w-3 h-3 text-white/30" />;
}

export default function CrewsPage() {
  const router = useRouter();
  const [crews, setCrews] = useState<Crew[]>([]);
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
      const result = await getCrews(params);
      setCrews(result.data || []);
      setTotal(result.meta?.total || 0);
    } catch (err) {
      console.error('Failed to fetch crews:', err);
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
      await generateCrews(params);
      setShowGenerateForm(false);
      setGenerateCity('');
      fetchData();
    } catch (err) {
      console.error('Failed to generate crews:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async (id: string) => {
    if (!confirmDate) return;
    setActionLoading(id);
    try {
      await confirmCrew(id, {
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
      console.error('Failed to confirm crew:', err);
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
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Crews</h1>
            <Badge variant="secondary" className="bg-white/[0.04] text-white/60 mono-num">
              {total}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-black border-white/[0.15] text-white w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/[0.15]">
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
              Generate Crews
            </Button>
          </div>
        </div>

        {/* Generate Form */}
        {showGenerateForm && (
          <div className="flex items-center gap-3 p-4 neon-card">
            <Input
              placeholder="City filter (optional)"
              value={generateCity}
              onChange={(e) => setGenerateCity(e.target.value)}
              className="bg-white/[0.04] border-white/[0.12] text-white max-w-xs"
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
              className="text-white/40"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Crew Cards */}
        {loading ? (
          <p className="text-white/30 text-center py-8">Loading...</p>
        ) : crews.length === 0 ? (
          <p className="text-white/30 text-center py-8">
            No crews found. Generate some to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {crews.map((crew) => (
              <div
                key={crew.id}
                className="bg-black border border-white/[0.15] rounded-lg p-4 hover:border-white/[0.25] transition-colors cursor-pointer"
                onClick={() => router.push(`/crm/crews/${crew.id}`)}
              >
                <div className="flex items-start justify-between">
                  {/* Left side: info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    {/* Name + City + Status */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-white text-lg">{crew.name}</h3>
                      {crew.city && (
                        <span className="text-sm text-white/40">{crew.city}</span>
                      )}
                      <Badge
                        variant="outline"
                        className={`uppercase tracking-wider text-xs font-semibold ${STATUS_COLORS[crew.status] || ''}`}
                      >
                        {crew.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Member count + event info */}
                    <div className="flex items-center gap-4 text-sm text-white/40">
                      <span className="flex items-center gap-1 mono-num">
                        <Users className="w-4 h-4" />
                        {crew.members?.length || 0} members
                      </span>
                      {crew.eventDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(crew.eventDate), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      {crew.eventLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {crew.eventLocation}
                        </span>
                      )}
                    </div>

                    {/* Member pills */}
                    {crew.members && crew.members.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {crew.members.map((member) => (
                          <span
                            key={member.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-xs text-white/60"
                          >
                            {member.lead?.name || 'Unknown'}
                            <RsvpIcon status={member.rsvpStatus} />
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inline confirm form */}
                    {confirmingId === crew.id && (
                      <div
                        className="flex items-end gap-3 mt-2 p-3 bg-white/[0.04] rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <label className="text-xs text-white/40 mb-1 block">
                            Event Date *
                          </label>
                          <Input
                            type="datetime-local"
                            value={confirmDate}
                            onChange={(e) => setConfirmDate(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.12] text-white w-52"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/40 mb-1 block">
                            Location
                          </label>
                          <Input
                            value={confirmLocation}
                            onChange={(e) => setConfirmLocation(e.target.value)}
                            placeholder="e.g. Coffee shop on Main St"
                            className="bg-white/[0.04] border-white/[0.12] text-white w-56"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/40 mb-1 block">
                            Notes
                          </label>
                          <Input
                            value={confirmNotes}
                            onChange={(e) => setConfirmNotes(e.target.value)}
                            placeholder="Optional notes"
                            className="bg-white/[0.04] border-white/[0.12] text-white w-48"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(crew.id)}
                          disabled={!confirmDate || actionLoading === crew.id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {actionLoading === crew.id ? (
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
                          className="text-white/40"
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
                    {crew.status === 'DRAFT' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setConfirmingId(crew.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={actionLoading === crew.id}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(crew.id, () => deleteCrew(crew.id))
                          }
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          disabled={actionLoading === crew.id}
                        >
                          Delete
                        </Button>
                      </>
                    )}

                    {crew.status === 'CONFIRMED' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          handleAction(crew.id, () =>
                            sendCrewInvitations(crew.id)
                          )
                        }
                        className="bg-yellow-600 hover:bg-yellow-700"
                        disabled={actionLoading === crew.id}
                      >
                        {actionLoading === crew.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Send Invitations'
                        )}
                      </Button>
                    )}

                    {crew.status === 'INVITED' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAction(crew.id, () =>
                              createCrewEvent(crew.id)
                            )
                          }
                          className="bg-green-600 hover:bg-green-700"
                          disabled={actionLoading === crew.id}
                        >
                          Create Event
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(crew.id, () =>
                              sendCrewReminders(crew.id)
                            )
                          }
                          className="border-white/[0.12] text-white/60 hover:bg-white/[0.06]"
                          disabled={actionLoading === crew.id}
                        >
                          Send Reminders
                        </Button>
                      </>
                    )}

                    {crew.status === 'EVENT_CREATED' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAction(crew.id, () =>
                              completeCrew(crew.id)
                            )
                          }
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={actionLoading === crew.id}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleAction(crew.id, () =>
                              sendCrewReminders(crew.id)
                            )
                          }
                          className="border-white/[0.12] text-white/60 hover:bg-white/[0.06]"
                          disabled={actionLoading === crew.id}
                        >
                          Send Reminders
                        </Button>
                      </>
                    )}

                    {crew.status !== 'COMPLETED' && crew.status !== 'CANCELLED' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleAction(crew.id, () => cancelCrew(crew.id))
                        }
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        disabled={actionLoading === crew.id}
                      >
                        Cancel
                      </Button>
                    )}

                    {actionLoading === crew.id && crew.status !== 'DRAFT' && (
                      <Loader2 className="w-4 h-4 animate-spin text-white/40" />
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
