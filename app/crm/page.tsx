'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  getCrmLeads,
  getAllTags,
  addTagsToLead,
  removeTagsFromLead,
  bulkAddTags,
  getSequences,
  enrollLeads,
} from '@/lib/api';
import type { CrmLead, DripSequence } from '@/lib/api';
import { STATUS_COLORS, ENROLLMENT_COLORS, formatStatus } from '@/lib/constants';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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


export default function CrmLeadsPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sequences, setSequences] = useState<DripSequence[]>([]);
  const [bulkTagInput, setBulkTagInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;

      const result = await getCrmLeads(params);
      setLeads(result.data || []);
      setTotal(result.meta?.total || 0);
      setPages(result.meta?.pages || 1);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    getSequences().then(setSequences).catch(console.error);
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const handleAddTag = async (leadId: string, tag: string) => {
    await addTagsToLead(leadId, [tag]);
    fetchData();
  };

  const handleRemoveTag = async (leadId: string, tag: string) => {
    await removeTagsFromLead(leadId, [tag]);
    fetchData();
  };

  const handleBulkTag = async () => {
    if (!bulkTagInput.trim() || selectedIds.size === 0) return;
    const tags = bulkTagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    await bulkAddTags(Array.from(selectedIds), tags);
    setBulkTagInput('');
    setSelectedIds(new Set());
    fetchData();
  };

  const handleBulkEnroll = async (sequenceId: string) => {
    if (selectedIds.size === 0) return;
    await enrollLeads(sequenceId, Array.from(selectedIds));
    setSelectedIds(new Set());
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CRM Leads</h1>
          <span className="text-sm text-gray-400">{total} leads</span>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white w-[160px]">
              <SelectValue placeholder="Status" />
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
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white w-[140px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="CALL">Call</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="WEB_FORM">Web Form</SelectItem>
              <SelectItem value="WEB_WAITLIST">Waitlist</SelectItem>
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

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800">
            <span className="text-sm text-gray-400">{selectedIds.size} selected</span>
            <Input
              placeholder="Tags (comma-separated)"
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white w-48 h-8 text-sm"
            />
            <Button size="sm" onClick={handleBulkTag} className="h-8">
              Tag Selected
            </Button>
            {sequences.length > 0 && (
              <Select onValueChange={handleBulkEnroll}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Enroll in..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  {sequences.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-400 h-8"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Leads Table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-gray-900">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedIds.size === leads.length}
                      onChange={toggleAll}
                      className="accent-blue-500"
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Name</TableHead>
                  <TableHead className="text-gray-400">Phone</TableHead>
                  <TableHead className="text-gray-400">City</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Source</TableHead>
                  <TableHead className="text-gray-400">Tags</TableHead>
                  <TableHead className="text-gray-400">Drip</TableHead>
                  <TableHead className="text-gray-400">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="accent-blue-500"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{lead.name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                      <TableCell>{lead.city || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[lead.status] || ''}>
                          {formatStatus(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                          {lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TagManager
                          tags={lead.tags || []}
                          onAdd={(tag) => handleAddTag(lead.id, tag)}
                          onRemove={(tag) => handleRemoveTag(lead.id, tag)}
                        />
                      </TableCell>
                      <TableCell>
                        {lead.dripEnrollments?.length > 0 ? (
                          <div className="space-y-1">
                            {lead.dripEnrollments.map((e) => (
                              <Badge
                                key={e.id}
                                variant="outline"
                                className={`text-xs ${ENROLLMENT_COLORS[e.status] || ''}`}
                              >
                                {e.sequence.name} (step {e.currentStep})
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="border-gray-800 text-gray-300"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-400">
              Page {page} of {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="border-gray-800 text-gray-300"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
