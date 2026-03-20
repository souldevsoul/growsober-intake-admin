'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import {
  getCrmLead,
  getLeadActivity,
  getLeadSms,
  addLeadNote,
  sendLeadSms,
  addTagsToLead,
  removeTagsFromLead,
  updateLead,
  retryPayment,
  pauseEnrollment,
  resumeEnrollment,
  cancelEnrollment,
  getEngagementScore,
  getLeadTimeline,
  updateLeadAvailability,
} from '@/lib/api';
import type { LeadDetail, LeadActivity as LeadActivityType, SmsMessage, TimelineEntry } from '@/lib/api';
import {
  STATUS_COLORS,
  ENROLLMENT_COLORS,
  ACTIVITY_ICONS,
  getScoreColor,
  formatStatus,
} from '@/lib/constants';

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
import { TagManager } from '@/components/crm/TagManager';

const STATUSES = ['CALLED', 'INFO_COLLECTED', 'LINK_SENT', 'PAID', 'MATCHED', 'FAILED'];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIMELINE_ICONS: Record<string, string> = {
  note: '📝',
  sms: '📱',
  drip: '📧',
  automation: '⚡',
  cohort: '👥',
  status_change: '🔄',
  tag: '🏷️',
  payment: '💳',
};

const TIMELINE_TYPE_COLORS: Record<string, string> = {
  note: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  sms: 'bg-green-500/20 text-green-300 border-green-500/30',
  drip: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  automation: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  cohort: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const TIMELINE_FILTERS = ['all', 'note', 'sms', 'drip', 'automation', 'cohort'] as const;

function getEngagementColor(score: number): string {
  if (score >= 70) return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (score >= 40) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<LeadActivityType[]>([]);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const [noteInput, setNoteInput] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [smsInput, setSmsInput] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);

  // Engagement score
  const [engagementScore, setEngagementScore] = useState<number | null>(null);

  // Unified timeline
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Availability
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const smsEndRef = useRef<HTMLDivElement>(null);

  const fetchLead = async () => {
    try {
      const data = await getCrmLead(id);
      setLead(data);
      // Initialize preferred days from lead data if available
      if ((data as any).preferredDays) {
        setPreferredDays((data as any).preferredDays);
      }
    } catch (err) {
      console.error('Failed to fetch lead:', err);
    }
  };

  const fetchActivities = async () => {
    try {
      const result = await getLeadActivity(id);
      setActivities(result.data || []);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    }
  };

  const fetchSms = async () => {
    try {
      const data = await getLeadSms(id);
      setSmsMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch SMS:', err);
    }
  };

  const fetchEngagementScore = async () => {
    try {
      const result = await getEngagementScore(id);
      setEngagementScore(result.engagementScore);
    } catch (err) {
      console.error('Failed to fetch engagement score:', err);
    }
  };

  const fetchTimeline = async (filter?: string) => {
    setTimelineLoading(true);
    try {
      const result = await getLeadTimeline(id, 1, filter || timelineFilter);
      setTimeline(result.data || []);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchLead(), fetchActivities(), fetchSms(), fetchEngagementScore(), fetchTimeline()]).finally(() =>
      setLoading(false),
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchTimeline(timelineFilter);
  }, [timelineFilter]);

  useEffect(() => {
    smsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [smsMessages]);

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    await updateLead(lead.id, { status: newStatus as LeadDetail['status'] });
    fetchLead();
    fetchActivities();
    fetchTimeline();
  };

  const handleAddTag = async (tag: string) => {
    if (!lead) return;
    await addTagsToLead(lead.id, [tag]);
    fetchLead();
    fetchActivities();
    fetchTimeline();
  };

  const handleRemoveTag = async (tag: string) => {
    if (!lead) return;
    await removeTagsFromLead(lead.id, [tag]);
    fetchLead();
    fetchActivities();
    fetchTimeline();
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !lead) return;
    setNoteLoading(true);
    try {
      await addLeadNote(lead.id, noteInput.trim());
      setNoteInput('');
      fetchActivities();
      fetchTimeline();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleSendSms = async () => {
    if (!smsInput.trim() || !lead) return;
    setSmsLoading(true);
    try {
      await sendLeadSms(lead.id, smsInput.trim());
      setSmsInput('');
      fetchSms();
      fetchActivities();
      fetchTimeline();
    } catch (err) {
      console.error('Failed to send SMS:', err);
    } finally {
      setSmsLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!lead) return;
    try {
      await retryPayment(lead.id);
      fetchLead();
      fetchActivities();
    } catch (err) {
      console.error('Failed to retry payment:', err);
    }
  };

  const handleEnrollmentAction = async (
    enrollmentId: string,
    action: 'pause' | 'resume' | 'cancel',
  ) => {
    if (action === 'pause') await pauseEnrollment(enrollmentId);
    else if (action === 'resume') await resumeEnrollment(enrollmentId);
    else await cancelEnrollment(enrollmentId);
    fetchLead();
    fetchActivities();
    fetchTimeline();
  };

  const handleDayToggle = async (day: string) => {
    if (!lead) return;
    setAvailabilityLoading(true);
    const newDays = preferredDays.includes(day)
      ? preferredDays.filter((d) => d !== day)
      : [...preferredDays, day];
    setPreferredDays(newDays);
    try {
      await updateLeadAvailability(lead.id, newDays);
    } catch (err) {
      console.error('Failed to update availability:', err);
      // Revert on error
      setPreferredDays(preferredDays);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
        <p className="text-white/30">Loading...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
        <p className="text-white/30">Lead not found</p>
      </div>
    );
  }

  const isPaid = lead.status === 'PAID' || lead.status === 'MATCHED';
  const stripeUrl = lead.paymentIntentId
    ? `https://dashboard.stripe.com/payments/${lead.paymentIntentId}`
    : null;

  return (
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/crm')}
            className="text-white/40"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{lead.name || 'Unknown'}</h1>
            <p className="text-white/40 font-mono text-sm">{lead.phone}</p>
          </div>
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="bg-black border-white/[0.15] text-white w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/[0.15]">
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="bg-white/[0.04] text-white/60 uppercase tracking-wider text-xs font-semibold">
            {lead.source}
          </Badge>
          <Badge
            variant="outline"
            className={getScoreColor(lead.score ?? 0)}
          >
            Score: <span className="mono-num">{lead.score ?? 0}</span>
          </Badge>
          {engagementScore !== null && (
            <Badge
              variant="outline"
              className={getEngagementColor(engagementScore)}
            >
              Engagement: <span className="mono-num">{engagementScore}</span>
            </Badge>
          )}
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="neon-card">
            <CardContent className="p-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">City</p>
              <p className="text-sm font-medium">{lead.city || '-'}</p>
            </CardContent>
          </Card>
          <Card className="neon-card">
            <CardContent className="p-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Sobriety Status</p>
              <p className="text-sm font-medium">{lead.sobrietyStatus || '-'}</p>
            </CardContent>
          </Card>
          <Card className="neon-card">
            <CardContent className="p-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Interests</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {lead.interests?.length > 0 ? (
                  lead.interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30 uppercase tracking-wider font-semibold"
                    >
                      {interest}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-white/30">-</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="neon-card">
            <CardContent className="p-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Tags</p>
              <TagManager
                tags={lead.tags || []}
                onAdd={handleAddTag}
                onRemove={handleRemoveTag}
              />
            </CardContent>
          </Card>
          <Card className="neon-card">
            <CardContent className="p-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Preferred Days</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {DAYS_OF_WEEK.map((day) => (
                  <label
                    key={day}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                      preferredDays.includes(day)
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-white/[0.04] text-white/40 border border-white/[0.08]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preferredDays.includes(day)}
                      onChange={() => handleDayToggle(day)}
                      disabled={availabilityLoading}
                      className="sr-only"
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <Card className="neon-card">
          <CardContent className="p-4 flex items-center gap-4">
            <p className="text-xs text-white/30 uppercase tracking-wider">Payment</p>
            {isPaid ? (
              <>
                <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30 uppercase tracking-wider text-xs font-semibold">
                  Paid
                </Badge>
                {lead.paidAt && (
                  <span className="text-sm text-white/40">
                    {format(new Date(lead.paidAt), 'MMM d, yyyy')}
                  </span>
                )}
                {stripeUrl && (
                  <a
                    href={stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 underline"
                  >
                    View in Stripe
                  </a>
                )}
              </>
            ) : lead.status === 'FAILED' ? (
              <>
                <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30 uppercase tracking-wider text-xs font-semibold">
                  Failed
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetryPayment}
                  className="border-white/[0.12] text-white/60 hover:bg-white/[0.06]"
                >
                  Retry Payment
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="bg-gray-500/20 text-white/60 border-gray-500/30 uppercase tracking-wider text-xs font-semibold">
                  Unpaid
                </Badge>
                {lead.status === 'INFO_COLLECTED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryPayment}
                    className="border-white/[0.12] text-white/60 hover:bg-white/[0.06]"
                  >
                    Send Payment Link
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Unified Timeline */}
        <Card className="neon-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Timeline</CardTitle>
              <Select value={timelineFilter} onValueChange={setTimelineFilter}>
                <SelectTrigger className="bg-black border-white/[0.15] text-white w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/[0.15]">
                  {TIMELINE_FILTERS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Note Input */}
            <div className="flex gap-2">
              <Input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNote();
                }}
                placeholder="Add a note..."
                className="bg-white/[0.04] border-white/[0.12] text-white placeholder:text-white/30"
              />
              <Button
                onClick={handleAddNote}
                disabled={noteLoading || !noteInput.trim()}
                className="shrink-0"
              >
                {noteLoading ? '...' : 'Add'}
              </Button>
            </div>

            {/* Timeline Entries */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {timelineLoading ? (
                <p className="text-sm text-white/30 text-center py-4">Loading timeline...</p>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">No activity yet</p>
              ) : (
                timeline.map((entry, idx) => (
                  <div
                    key={`${entry.type}-${entry.timestamp}-${idx}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]"
                  >
                    <span className="text-lg shrink-0">
                      {TIMELINE_ICONS[entry.type] || ACTIVITY_ICONS[entry.type] || '📋'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/60">{entry.content}</p>
                      <p className="text-xs text-white/30 mt-1">
                        {formatDistanceToNow(new Date(entry.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 uppercase tracking-wider font-semibold ${
                        TIMELINE_TYPE_COLORS[entry.type] || 'bg-white/[0.04] text-white/40 border-white/[0.12]'
                      }`}
                    >
                      {entry.type.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Two-Column Layout: Activity + SMS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Activity Timeline + Notes */}
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Timeline */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {activities.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-4">No activity yet</p>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]"
                    >
                      <span className="text-lg shrink-0">
                        {ACTIVITY_ICONS[activity.type] || '📋'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/60">{activity.content}</p>
                        <p className="text-xs text-white/30 mt-1">
                          {activity.createdBy !== 'system' && (
                            <span className="text-white/40">{activity.createdBy} &middot; </span>
                          )}
                          {formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs bg-white/[0.04] text-white/40 border-white/[0.12] shrink-0 uppercase tracking-wider font-semibold"
                      >
                        {activity.type.replaceAll('_', ' ')}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: SMS Conversation */}
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">SMS Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {smsMessages.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-4">No messages yet</p>
                ) : (
                  smsMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'OUT' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.direction === 'OUT'
                            ? 'bg-blue-600/30 text-blue-100 border border-blue-500/30'
                            : 'bg-white/[0.04] text-white/60 border border-white/[0.12]'
                        }`}
                      >
                        <p className="text-sm">{msg.body}</p>
                        <p className="text-xs mt-1 opacity-60">
                          {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={smsEndRef} />
              </div>

              {/* Compose */}
              <div className="flex gap-2">
                <textarea
                  value={smsInput}
                  onChange={(e) => setSmsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendSms();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.12] rounded-md p-2 text-sm text-white placeholder:text-white/30 resize-none"
                  rows={2}
                />
                <Button
                  onClick={handleSendSms}
                  disabled={smsLoading || !smsInput.trim()}
                  className="shrink-0 self-end"
                >
                  {smsLoading ? '...' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Drip Enrollments */}
        <Card className="neon-card">
          <CardHeader>
            <CardTitle className="text-lg">
              Drip Enrollments (<span className="mono-num">{lead.dripEnrollments?.length || 0}</span>)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.08]">
                  <TableHead className="text-white/40">Sequence</TableHead>
                  <TableHead className="text-white/40">Current Step</TableHead>
                  <TableHead className="text-white/40">Status</TableHead>
                  <TableHead className="text-white/40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lead.dripEnrollments?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-white/30 py-6"
                    >
                      No enrollments
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.dripEnrollments.map((e) => (
                    <TableRow
                      key={e.id}
                      className="border-white/[0.08] hover:bg-white/[0.04]"
                    >
                      <TableCell className="font-medium">
                        {e.sequence.name}
                      </TableCell>
                      <TableCell className="mono-num">Step {e.currentStep}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`uppercase tracking-wider text-xs font-semibold ${ENROLLMENT_COLORS[e.status] || ''}`}
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {e.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-yellow-400"
                              onClick={() =>
                                handleEnrollmentAction(e.id, 'pause')
                              }
                            >
                              Pause
                            </Button>
                          )}
                          {e.status === 'PAUSED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-blue-400"
                              onClick={() =>
                                handleEnrollmentAction(e.id, 'resume')
                              }
                            >
                              Resume
                            </Button>
                          )}
                          {(e.status === 'ACTIVE' || e.status === 'PAUSED') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-400"
                              onClick={() =>
                                handleEnrollmentAction(e.id, 'cancel')
                              }
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
