'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { getLeads, getStats, updateLead, retryPayment } from '@/lib/api';
import type { Lead, Stats } from '@/lib/api';

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

const STATUS_COLORS: Record<string, string> = {
  CALLED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  INFO_COLLECTED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  LINK_SENT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  PAID: 'bg-green-500/20 text-green-300 border-green-500/30',
  MATCHED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;

      const [leadsRes, statsRes] = await Promise.all([
        getLeads(params),
        getStats(),
      ]);

      setLeads(Array.isArray(leadsRes) ? leadsRes : leadsRes.data || leadsRes);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSendLink = async (id: string) => {
    setActionLoading(id);
    try {
      await updateLead(id, { status: 'LINK_SENT' });
      await fetchData();
    } catch (err) {
      console.error('Failed to send link:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (id: string) => {
    setActionLoading(id);
    try {
      await retryPayment(id);
      await fetchData();
    } catch (err) {
      console.error('Failed to retry payment:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">GrowSober Intake Admin</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.total ?? '-'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.today ?? '-'}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">
                {stats?.byStatus?.PAID ?? '-'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Matched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-400">
                {stats?.byStatus?.MATCHED ?? '-'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Conversion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.conversionRate ?? '-'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="CALLED">Called</SelectItem>
              <SelectItem value="INFO_COLLECTED">Info Collected</SelectItem>
              <SelectItem value="LINK_SENT">Link Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="MATCHED">Matched</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={fetchData}
            className="border-gray-800 text-gray-300 hover:bg-gray-800"
          >
            Refresh
          </Button>
        </div>

        {/* Leads Table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-gray-900">
                  <TableHead className="text-gray-400">Name</TableHead>
                  <TableHead className="text-gray-400">Phone</TableHead>
                  <TableHead className="text-gray-400">City</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Source</TableHead>
                  <TableHead className="text-gray-400">Hub</TableHead>
                  <TableHead className="text-gray-400">When</TableHead>
                  <TableHead className="text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="font-medium">
                        {lead.name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {lead.phone}
                      </TableCell>
                      <TableCell>{lead.city || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[lead.status] || ''}
                        >
                          {lead.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                          {lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.hub?.name || '-'}</TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {formatDistanceToNow(new Date(lead.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {lead.status === 'INFO_COLLECTED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-500/30 text-blue-300 hover:bg-blue-500/20 h-7 text-xs"
                              disabled={actionLoading === lead.id}
                              onClick={() => handleSendLink(lead.id)}
                            >
                              Send Link
                            </Button>
                          )}
                          {(lead.status === 'LINK_SENT' || lead.status === 'FAILED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 h-7 text-xs"
                              disabled={actionLoading === lead.id}
                              onClick={() => handleRetry(lead.id)}
                            >
                              Retry
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
