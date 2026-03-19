'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  getCrmLeads,
  getAllTags,
  addTagsToLead,
  removeTagsFromLead,
  bulkAddTags,
  getSequences,
  enrollLeads,
  getSegments,
  createSegment,
  deleteSegment,
  updateLead,
} from '@/lib/api';
import type { CrmLead, DripSequence, SavedSegment } from '@/lib/api';
import { STATUS_COLORS, ENROLLMENT_COLORS, formatStatus } from '@/lib/constants';
import { KanbanBoard } from '@/components/crm/KanbanBoard';

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
import { SegmentBar } from '@/components/crm/SegmentBar';


export default function CrmLeadsPage() {
  const router = useRouter();
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
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');

  // Segment state
  const [segments, setSegments] = useState<SavedSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

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

  // Fetch saved segments on mount
  const fetchSegments = useCallback(async () => {
    try {
      const data = await getSegments();
      setSegments(data);
    } catch (err) {
      console.error('Failed to fetch segments:', err);
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const handleSegmentSelect = (filters: Record<string, string>) => {
    // Find the segment that matches these filters so we can highlight it
    const segment = segments.find(
      (s) => JSON.stringify(s.filters) === JSON.stringify(filters)
    );
    setActiveSegmentId(segment?.id || null);

    // Apply filters to filter state
    setStatusFilter(filters.status || 'all');
    setSourceFilter(filters.source || 'all');
    setSearch(filters.search || '');
    setPage(1);
  };

  const handleSegmentSave = async (name: string) => {
    const filters: Record<string, string> = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (sourceFilter !== 'all') filters.source = sourceFilter;
    if (search) filters.search = search;

    try {
      await createSegment(name, filters);
      await fetchSegments();
    } catch (err) {
      console.error('Failed to save segment:', err);
    }
  };

  const handleSegmentDelete = async (id: string) => {
    try {
      await deleteSegment(id);
      if (activeSegmentId === id) setActiveSegmentId(null);
      await fetchSegments();
    } catch (err) {
      console.error('Failed to delete segment:', err);
    }
  };

  // Show save button when any filter is active
  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all' || search !== '';

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

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateLead(leadId, { status: newStatus as CrmLead['status'] });
      fetchData();
    } catch (err) {
      console.error('Failed to update lead status:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CRM Leads</h1>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-white/[0.12] overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white/[0.06] text-white'
                    : 'bg-black text-white/40 hover:text-white/60'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('pipeline')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'pipeline'
                    ? 'bg-white/[0.06] text-white'
                    : 'bg-black text-white/40 hover:text-white/60'
                }`}
              >
                Pipeline
              </button>
            </div>
            <span className="text-sm text-white/40 mono-num">{total} leads</span>
          </div>
        </div>

        {/* Saved Segments */}
        <SegmentBar
          segments={segments}
          activeSegmentId={activeSegmentId}
          onSelect={handleSegmentSelect}
          onSave={handleSegmentSave}
          onDelete={handleSegmentDelete}
          showSave={hasActiveFilters}
        />

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-black border-white/[0.15] text-white placeholder:text-white/30 max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="bg-black border-white/[0.15] text-white w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/[0.15]">
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
            <SelectTrigger className="bg-black border-white/[0.15] text-white w-[140px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/[0.15]">
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
            className="border-white/[0.15] text-white/60 hover:bg-white/[0.06]"
          >
            Refresh
          </Button>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 neon-card">
            <span className="text-sm text-white/40 mono-num">{selectedIds.size} selected</span>
            <Input
              placeholder="Tags (comma-separated)"
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              className="bg-white/[0.04] border-white/[0.12] text-white w-48 h-8 text-sm"
            />
            <Button size="sm" onClick={handleBulkTag} className="h-8">
              Tag Selected
            </Button>
            {sequences.length > 0 && (
              <Select onValueChange={handleBulkEnroll}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.12] text-white w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Enroll in..." />
                </SelectTrigger>
                <SelectContent className="bg-black border-white/[0.15]">
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
              className="text-white/40 h-8"
            >
              Clear
            </Button>
          </div>
        )}

        {/* View: Pipeline or Table */}
        {viewMode === 'pipeline' ? (
          loading ? (
            <div className="text-center text-white/30 py-8">Loading...</div>
          ) : (
            <KanbanBoard leads={leads} onStatusChange={handleStatusChange} />
          )
        ) : (
          <>
            {/* Leads Table */}
            <Card className="neon-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.08] hover:bg-transparent">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={leads.length > 0 && selectedIds.size === leads.length}
                          onChange={toggleAll}
                          className="accent-blue-500"
                        />
                      </TableHead>
                      <TableHead className="text-white/40">Name</TableHead>
                      <TableHead className="text-white/40">Phone</TableHead>
                      <TableHead className="text-white/40">City</TableHead>
                      <TableHead className="text-white/40">Status</TableHead>
                      <TableHead className="text-white/40">Source</TableHead>
                      <TableHead className="text-white/40">Tags</TableHead>
                      <TableHead className="text-white/40">Drip</TableHead>
                      <TableHead className="text-white/40">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-white/30 py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : leads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-white/30 py-8">
                          No leads found
                        </TableCell>
                      </TableRow>
                    ) : (
                      leads.map((lead) => (
                        <TableRow key={lead.id} onClick={() => router.push(`/crm/leads/${lead.id}`)} className="border-white/[0.08] hover:bg-white/[0.04] cursor-pointer">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead.id)}
                              onChange={(e) => { e.stopPropagation(); toggleSelect(lead.id); }}
                              className="accent-blue-500"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{lead.name || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                          <TableCell>{lead.city || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`uppercase tracking-wider text-xs font-semibold ${STATUS_COLORS[lead.status] || ''}`}>
                              {formatStatus(lead.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-white/[0.04] text-white/60 uppercase tracking-wider text-xs font-semibold">
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
                                    className={`text-xs uppercase tracking-wider font-semibold ${ENROLLMENT_COLORS[e.status] || ''}`}
                                  >
                                    {e.sequence.name} (step {e.currentStep})
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-white/30 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-white/40 text-sm">
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
                  className="border-white/[0.15] text-white/60"
                >
                  Previous
                </Button>
                <span className="text-sm text-white/40 mono-num">
                  Page {page} of {pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                  className="border-white/[0.15] text-white/60"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
