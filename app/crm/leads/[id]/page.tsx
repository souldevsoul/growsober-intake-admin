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
} from '@/lib/api';
import type { LeadDetail, LeadActivity as LeadActivityType, SmsMessage } from '@/lib/api';
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

  const smsEndRef = useRef<HTMLDivElement>(null);

  const fetchLead = async () => {
    try {
      const data = await getCrmLead(id);
      setLead(data);
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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchLead(), fetchActivities(), fetchSms()]).finally(() =>
      setLoading(false),
    );
  }, [id]);

  useEffect(() => {
    smsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [smsMessages]);

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    await updateLead(lead.id, { status: newStatus as LeadDetail['status'] });
    fetchLead();
    fetchActivities();
  };

  const handleAddTag = async (tag: string) => {
    if (!lead) return;
    await addTagsToLead(lead.id, [tag]);
    fetchLead();
    fetchActivities();
  };

  const handleRemoveTag = async (tag: string) => {
    if (!lead) return;
    await removeTagsFromLead(lead.id, [tag]);
    fetchLead();
    fetchActivities();
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !lead) return;
    setNoteLoading(true);
    try {
      await addLeadNote(lead.id, noteInput.trim());
      setNoteInput('');
      fetchActivities();
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <p className="text-gray-500">Lead not found</p>
      </div>
    );
  }

  const isPaid = lead.status === 'PAID' || lead.status === 'MATCHED';
  const stripeUrl = lead.paymentIntentId
    ? `https://dashboard.stripe.com/payments/${lead.paymentIntentId}`
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/crm')}
            className="text-gray-400"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{lead.name || 'Unknown'}</h1>
            <p className="text-gray-400 font-mono text-sm">{lead.phone}</p>
          </div>
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="bg-gray-800 text-gray-300">
            {lead.source}
          </Badge>
          <Badge
            variant="outline"
            className={getScoreColor(lead.score ?? 0)}
          >
            Score: {lead.score ?? 0}
          </Badge>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">City</p>
              <p className="text-sm font-medium">{lead.city || '-'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sobriety Status</p>
              <p className="text-sm font-medium">{lead.sobrietyStatus || '-'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Interests</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {lead.interests?.length > 0 ? (
                  lead.interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30"
                    >
                      {interest}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tags</p>
              <TagManager
                tags={lead.tags || []}
                onAdd={handleAddTag}
                onRemove={handleRemoveTag}
              />
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 flex items-center gap-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Payment</p>
            {isPaid ? (
              <>
                <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30">
                  Paid
                </Badge>
                {lead.paidAt && (
                  <span className="text-sm text-gray-400">
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
                <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">
                  Failed
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetryPayment}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Retry Payment
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="bg-gray-500/20 text-gray-300 border-gray-500/30">
                  Unpaid
                </Badge>
                {lead.status === 'INFO_COLLECTED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryPayment}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Send Payment Link
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Two-Column Layout: Activity + SMS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Activity Timeline + Notes */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">Activity</CardTitle>
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
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={noteLoading || !noteInput.trim()}
                  className="shrink-0"
                >
                  {noteLoading ? '...' : 'Add'}
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {activities.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
                    >
                      <span className="text-lg shrink-0">
                        {ACTIVITY_ICONS[activity.type] || '📋'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300">{activity.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {activity.createdBy !== 'system' && (
                            <span className="text-gray-400">{activity.createdBy} &middot; </span>
                          )}
                          {formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs bg-gray-700/50 text-gray-400 border-gray-600 shrink-0"
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
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">SMS Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {smsMessages.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>
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
                            : 'bg-gray-800 text-gray-300 border border-gray-700'
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
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-md p-2 text-sm text-white placeholder:text-gray-500 resize-none"
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
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">
              Drip Enrollments ({lead.dripEnrollments?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Sequence</TableHead>
                  <TableHead className="text-gray-400">Current Step</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!lead.dripEnrollments?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-gray-500 py-6"
                    >
                      No enrollments
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.dripEnrollments.map((e) => (
                    <TableRow
                      key={e.id}
                      className="border-gray-800 hover:bg-gray-800/50"
                    >
                      <TableCell className="font-medium">
                        {e.sequence.name}
                      </TableCell>
                      <TableCell>Step {e.currentStep}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ENROLLMENT_COLORS[e.status] || ''}
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
