'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import {
  getCohort,
  confirmCohort,
  sendCohortInvitations,
  createCohortEvent,
  sendCohortReminders,
  completeCohort,
  cancelCohort,
  deleteCohort,
  addCohortMember,
  removeCohortMember,
  updateMemberRsvp,
  markMemberAttendance,
  getCrmLeads,
  getCohortChat,
  sendCohortChatMessage,
  getNpsResults,
  sendNpsSurveys,
  recreateCohort,
} from '@/lib/api';
import type { Cohort, CohortMember, CrmLead, ChatMessage, NpsResults } from '@/lib/api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-white/60 border-gray-500/30',
  CONFIRMED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  INVITED: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  EVENT_CREATED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  COMPLETED: 'bg-green-500/20 text-green-300 border-green-500/30',
  CANCELLED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const RSVP_BADGE: Record<string, string> = {
  PENDING: 'bg-gray-500/20 text-white/60 border-gray-500/30',
  CONFIRMED: 'bg-green-500/20 text-green-300 border-green-500/30',
  DECLINED: 'bg-red-500/20 text-red-300 border-red-500/30',
  CANCELLED: 'bg-gray-500/20 text-white/40 border-gray-500/30',
};

export default function CohortDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm form
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [confirmDate, setConfirmDate] = useState('');
  const [confirmLocation, setConfirmLocation] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');

  // Add member search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CrmLead[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // NPS
  const [npsResults, setNpsResults] = useState<NpsResults | null>(null);
  const [npsLoading, setNpsLoading] = useState(false);
  const [npsSending, setNpsSending] = useState(false);

  // Recreate
  const [recreateLoading, setRecreateLoading] = useState(false);

  const fetchCohort = useCallback(async () => {
    try {
      const data = await getCohort(id);
      setCohort(data);
    } catch (err) {
      console.error('Failed to fetch cohort:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchChat = useCallback(async () => {
    setChatLoading(true);
    try {
      const result = await getCohortChat(id);
      setChatMessages(result.data || []);
    } catch (err) {
      console.error('Failed to fetch chat:', err);
    } finally {
      setChatLoading(false);
    }
  }, [id]);

  const fetchNps = useCallback(async () => {
    setNpsLoading(true);
    try {
      const result = await getNpsResults(id);
      setNpsResults(result);
    } catch (err) {
      console.error('Failed to fetch NPS:', err);
    } finally {
      setNpsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchCohort();
      fetchChat();
      fetchNps();
    }
  }, [id, fetchCohort, fetchChat, fetchNps]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Debounced lead search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await getCrmLeads({ status: 'MATCHED', search: searchQuery });
        // Filter out leads already in the cohort
        const memberLeadIds = new Set(cohort?.members?.map((m) => m.leadId) || []);
        setSearchResults(result.data.filter((l) => !memberLeadIds.has(l.id)));
      } catch (err) {
        console.error('Failed to search leads:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, cohort?.members]);

  const withAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    try {
      await fn();
      await fetchCohort();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = () =>
    withAction(async () => {
      await confirmCohort(id, {
        eventDate: new Date(confirmDate).toISOString(),
        eventLocation: confirmLocation || undefined,
        eventNotes: confirmNotes || undefined,
      });
      setShowConfirmForm(false);
    });

  const handleSendInvitations = () => withAction(() => sendCohortInvitations(id));
  const handleCreateEvent = () => withAction(() => createCohortEvent(id));
  const handleSendReminders = () => withAction(() => sendCohortReminders(id));
  const handleComplete = () => withAction(() => completeCohort(id));

  const handleCancel = () => {
    if (!confirm('Cancel this cohort? This cannot be undone.')) return;
    withAction(() => cancelCohort(id));
  };

  const handleDelete = () => {
    if (!confirm('Delete this cohort? This cannot be undone.')) return;
    withAction(async () => {
      await deleteCohort(id);
      router.push('/crm/cohorts');
    });
  };

  const handleAddMember = (leadId: string) =>
    withAction(async () => {
      await addCohortMember(id, leadId);
      setSearchQuery('');
      setSearchResults([]);
    });

  const handleRemoveMember = (memberId: string) =>
    withAction(() => removeCohortMember(id, memberId));

  const handleRsvp = (memberId: string, rsvpStatus: string) =>
    withAction(() => updateMemberRsvp(memberId, rsvpStatus));

  const handleAttendance = (memberId: string, attended: boolean) =>
    withAction(() => markMemberAttendance(memberId, attended));

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    setChatSending(true);
    try {
      await sendCohortChatMessage(id, chatInput.trim());
      setChatInput('');
      fetchChat();
    } catch (err) {
      console.error('Failed to send chat message:', err);
    } finally {
      setChatSending(false);
    }
  };

  const handleSendNps = async () => {
    setNpsSending(true);
    try {
      await sendNpsSurveys(id);
      fetchNps();
    } catch (err) {
      console.error('Failed to send NPS surveys:', err);
    } finally {
      setNpsSending(false);
    }
  };

  const handleRecreateCohort = async () => {
    setRecreateLoading(true);
    try {
      const newCohort = await recreateCohort(id);
      router.push(`/crm/cohorts/${newCohort.id}`);
    } catch (err) {
      console.error('Failed to recreate cohort:', err);
    } finally {
      setRecreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
        <p className="text-white/30">Loading...</p>
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
        <p className="text-white/30">Cohort not found</p>
      </div>
    );
  }

  const members = cohort.members || [];
  const isDraft = cohort.status === 'DRAFT';
  const isConfirmed = cohort.status === 'CONFIRMED';
  const isInvited = cohort.status === 'INVITED';
  const isEventCreated = cohort.status === 'EVENT_CREATED';
  const isCompleted = cohort.status === 'COMPLETED';
  const isCancelled = cohort.status === 'CANCELLED';
  const showAttendance = isEventCreated || isCompleted;
  const showRsvpActions = isInvited || isEventCreated || isCompleted;

  // RSVP summary
  const rsvpCounts = members.reduce(
    (acc, m) => {
      acc[m.rsvpStatus] = (acc[m.rsvpStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const rsvpSummary = [
    rsvpCounts.CONFIRMED && `${rsvpCounts.CONFIRMED} confirmed`,
    rsvpCounts.PENDING && `${rsvpCounts.PENDING} pending`,
    rsvpCounts.DECLINED && `${rsvpCounts.DECLINED} declined`,
    rsvpCounts.CANCELLED && `${rsvpCounts.CANCELLED} cancelled`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/crm/cohorts')}
            className="text-white/40"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{cohort.name}</h1>
            <p className="text-white/40 text-sm">
              {cohort.city || 'No city'}{cohort.hub ? ` \u00b7 ${cohort.hub.name}` : ''}
            </p>
          </div>
          <Badge variant="outline" className={`uppercase tracking-wider text-xs font-semibold ${STATUS_BADGE[cohort.status] || ''}`}>
            {cohort.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button
                onClick={() => setShowConfirmForm(true)}
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirm
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={actionLoading}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Delete
              </Button>
            </>
          )}
          {isConfirmed && (
            <Button
              onClick={handleSendInvitations}
              disabled={actionLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Send Invitations
            </Button>
          )}
          {isInvited && (
            <>
              <Button
                onClick={handleCreateEvent}
                disabled={actionLoading}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                Create Event
              </Button>
              <Button
                variant="outline"
                onClick={handleSendReminders}
                disabled={actionLoading}
                className="border-white/[0.12] text-white/60 hover:bg-white/[0.06]"
              >
                Send Reminders
              </Button>
            </>
          )}
          {isEventCreated && (
            <>
              <Button
                onClick={handleComplete}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                Complete
              </Button>
              <Button
                variant="outline"
                onClick={handleSendReminders}
                disabled={actionLoading}
                className="border-white/[0.12] text-white/60 hover:bg-white/[0.06]"
              >
                Send Reminders
              </Button>
            </>
          )}
          {isCompleted && (
            <Button
              onClick={handleRecreateCohort}
              disabled={recreateLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {recreateLoading ? 'Recreating...' : 'Recreate Cohort'}
            </Button>
          )}
          {!isCompleted && !isCancelled && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={actionLoading}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Cancel Cohort
            </Button>
          )}
        </div>

        {/* Confirm Form */}
        {showConfirmForm && (
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">Confirm Cohort</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-white/30 block mb-1">Event Date *</label>
                <Input
                  type="datetime-local"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  className="bg-white/[0.04] border-white/[0.12] text-white max-w-xs"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1">Location</label>
                <Input
                  value={confirmLocation}
                  onChange={(e) => setConfirmLocation(e.target.value)}
                  placeholder="e.g. Community Center, 123 Main St"
                  className="bg-white/[0.04] border-white/[0.12] text-white placeholder:text-white/30 max-w-md"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 block mb-1">Notes</label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Any additional details..."
                  className="w-full max-w-md bg-white/[0.04] border border-white/[0.12] rounded-md p-2 text-sm text-white placeholder:text-white/30 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConfirm}
                  disabled={!confirmDate || actionLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Confirm Cohort
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirmForm(false)}
                  className="text-white/40"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Details */}
        {cohort.eventDate && (
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-medium">
                    {format(new Date(cohort.eventDate), 'PPP p')}
                  </p>
                </div>
                {cohort.eventLocation && (
                  <div>
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Location</p>
                    <p className="text-sm font-medium">{cohort.eventLocation}</p>
                  </div>
                )}
                {cohort.eventNotes && (
                  <div>
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm text-white/60">{cohort.eventNotes}</p>
                  </div>
                )}
              </div>
              {cohort.event && (
                <div className="pt-2 border-t border-white/[0.08]">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Event</p>
                  <p className="text-sm font-medium text-blue-400">{cohort.event.title}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* NPS Section */}
        <Card className="neon-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">NPS Survey</CardTitle>
              <Button
                onClick={handleSendNps}
                disabled={npsSending}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {npsSending ? 'Sending...' : 'Send NPS Survey'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {npsLoading ? (
              <p className="text-sm text-white/30">Loading NPS data...</p>
            ) : npsResults && npsResults.totalResponses > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 text-center">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Responses</p>
                  <p className="text-2xl font-bold mono-num">{npsResults.totalResponses}</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 text-center">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Average Score</p>
                  <p className="text-2xl font-bold mono-num">{npsResults.averageScore.toFixed(1)}</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 text-center">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-1">NPS</p>
                  <p className={`text-2xl font-bold mono-num ${
                    npsResults.nps >= 50 ? 'text-green-400' : npsResults.nps >= 0 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {npsResults.nps > 0 ? '+' : ''}{npsResults.nps}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/30 text-center py-4">No NPS responses yet. Send a survey to collect feedback.</p>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="neon-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Members (<span className="mono-num">{members.length}</span>)</CardTitle>
              {rsvpSummary && (
                <p className="text-sm text-white/40">{rsvpSummary}</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.08]">
                  <TableHead className="text-white/40">Name</TableHead>
                  <TableHead className="text-white/40">Phone</TableHead>
                  <TableHead className="text-white/40">Interests</TableHead>
                  <TableHead className="text-white/40">RSVP Status</TableHead>
                  {showAttendance && (
                    <TableHead className="text-white/40">Attendance</TableHead>
                  )}
                  <TableHead className="text-white/40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showAttendance ? 6 : 5}
                      className="text-center text-white/30 py-6"
                    >
                      No members yet
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow
                      key={member.id}
                      className="border-white/[0.08] hover:bg-white/[0.04]"
                    >
                      <TableCell className="font-medium">
                        {member.lead.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {member.lead.phone}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.lead.interests?.length ? (
                            member.lead.interests.map((interest) => (
                              <Badge
                                key={interest}
                                variant="outline"
                                className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30 uppercase tracking-wider font-semibold"
                              >
                                {interest}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-white/30 text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`uppercase tracking-wider text-xs font-semibold ${RSVP_BADGE[member.rsvpStatus] || ''}`}
                        >
                          {member.rsvpStatus}
                        </Badge>
                      </TableCell>
                      {showAttendance && (
                        <TableCell>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={member.attended}
                              onChange={(e) =>
                                handleAttendance(member.id, e.target.checked)
                              }
                              disabled={actionLoading}
                              className="w-4 h-4 rounded border-white/[0.12] bg-white/[0.04] text-green-500 focus:ring-green-500/30"
                            />
                            <span className="text-sm text-white/40">
                              {member.attended ? 'Attended' : 'Not attended'}
                            </span>
                          </label>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1">
                          {showRsvpActions && member.rsvpStatus === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-green-400"
                                onClick={() => handleRsvp(member.id, 'CONFIRMED')}
                                disabled={actionLoading}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-red-400"
                                onClick={() => handleRsvp(member.id, 'DECLINED')}
                                disabled={actionLoading}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                          {showRsvpActions && member.rsvpStatus === 'CONFIRMED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-400"
                              onClick={() => handleRsvp(member.id, 'CANCELLED')}
                              disabled={actionLoading}
                            >
                              Cancel
                            </Button>
                          )}
                          {isDraft && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-400 hover:text-red-300"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={actionLoading}
                            >
                              Remove
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

        {/* Add Member (DRAFT only) */}
        {isDraft && (
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">Add Member</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search matched leads by name or phone..."
                className="bg-white/[0.04] border-white/[0.12] text-white placeholder:text-white/30 max-w-md"
              />
              {searchLoading && (
                <p className="text-sm text-white/30">Searching...</p>
              )}
              {searchResults.length > 0 && (
                <div className="border border-white/[0.15] rounded-md overflow-hidden max-w-md">
                  {searchResults.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleAddMember(lead.id)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.08] last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{lead.name || 'Unknown'}</p>
                        <p className="text-xs text-white/30 font-mono">{lead.phone}</p>
                      </div>
                      <span className="text-xs text-blue-400">+ Add</span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
                <p className="text-sm text-white/30">No matching leads found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cohort Chat */}
        <Card className="neon-card">
          <CardHeader>
            <CardTitle className="text-lg">Cohort Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messages */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {chatLoading ? (
                <p className="text-sm text-white/30 text-center py-4">Loading chat...</p>
              ) : chatMessages.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">No messages yet</p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${msg.isSystem ? 'flex justify-center' : 'flex justify-start'}`}
                  >
                    {msg.isSystem ? (
                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1">
                        <p className="text-xs text-white/40 italic">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="max-w-[80%] rounded-lg p-3 bg-white/[0.04] border border-white/[0.12]">
                        <p className="text-xs text-blue-400 font-medium mb-1">
                          {msg.lead?.name || 'Admin'}
                        </p>
                        <p className="text-sm text-white/60">{msg.content}</p>
                        <p className="text-xs text-white/30 mt-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Compose */}
            <div className="flex gap-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Type a message to the cohort..."
                className="flex-1 bg-white/[0.04] border border-white/[0.12] rounded-md p-2 text-sm text-white placeholder:text-white/30 resize-none"
                rows={2}
              />
              <Button
                onClick={handleSendChat}
                disabled={chatSending || !chatInput.trim()}
                className="shrink-0 self-end"
              >
                {chatSending ? '...' : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
