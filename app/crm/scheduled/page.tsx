'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getScheduledMessages, cancelScheduledMessage, sendScheduledNow } from '@/lib/api';
import type { ScheduledMessage } from '@/lib/api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  SENT: 'bg-green-500/20 text-green-300 border-green-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  FAILED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function ScheduledMessagesPage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, pages: 1 });

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page) };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const result = await getScheduledMessages(params);
      setMessages(result.data);
      setMeta(result.meta);
    } catch (err) {
      console.error('Failed to fetch scheduled messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [page, statusFilter]);

  const handleCancel = async (id: string) => {
    try {
      await cancelScheduledMessage(id);
      fetchMessages();
    } catch (err) {
      console.error('Failed to cancel message:', err);
    }
  };

  const handleSendNow = async (id: string) => {
    try {
      await sendScheduledNow(id);
      fetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Scheduled Messages</h1>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Status:</label>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg">
              {meta.total} message{meta.total !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            ) : messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No scheduled messages found.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800">
                      <TableHead className="text-gray-400">Lead Name</TableHead>
                      <TableHead className="text-gray-400">Phone</TableHead>
                      <TableHead className="text-gray-400">Message</TableHead>
                      <TableHead className="text-gray-400">Scheduled For</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id} className="border-gray-800">
                        <TableCell className="text-white font-medium">
                          {msg.lead.name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-gray-300">{msg.lead.phone}</TableCell>
                        <TableCell className="text-gray-300 max-w-xs">
                          {msg.content.length > 60
                            ? msg.content.slice(0, 60) + '...'
                            : msg.content}
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {format(new Date(msg.scheduledAt), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={STATUS_BADGES[msg.status] || STATUS_BADGES.PENDING}
                          >
                            {msg.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {msg.status === 'PENDING' && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                                onClick={() => handleCancel(msg.id)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleSendNow(msg.id)}
                              >
                                Send Now
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {meta.pages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                    <span className="text-sm text-gray-400">
                      Page {meta.page} of {meta.pages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800"
                        disabled={page >= meta.pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
