import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const API_KEY = process.env.NEXT_PUBLIC_INTAKE_API_KEY || '';

export const api = axios.create({
  baseURL: `${API_BASE}/phone-intake/admin`,
  headers: { 'x-api-key': API_KEY },
});

export const crmApi = axios.create({
  baseURL: `${API_BASE}/crm`,
  headers: { 'x-api-key': API_KEY },
});

// ============================================================================
// INTAKE TYPES
// ============================================================================

export interface Lead {
  id: string;
  phone: string;
  name: string | null;
  city: string | null;
  sobrietyStatus: string | null;
  interests: string[];
  status: 'CALLED' | 'INFO_COLLECTED' | 'LINK_SENT' | 'PAID' | 'MATCHED' | 'FAILED';
  source: 'CALL' | 'SMS';
  hubId: string | null;
  hub: { id: string; name: string } | null;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  matchedAt: string | null;
}

export interface Stats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  conversionRate: string;
}

// ============================================================================
// CRM TYPES
// ============================================================================

export interface CrmLead extends Lead {
  tags: string[];
  dripEnrollments: Array<{
    id: string;
    status: string;
    currentStep: number;
    sequence: { name: string };
  }>;
}

export interface DripStep {
  id: string;
  stepNumber: number;
  delayMinutes: number;
  channel: string;
  content: string;
  isActive: boolean;
}

export interface DripSequence {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerValue: string | null;
  isActive: boolean;
  steps: DripStep[];
  _count: { enrollments: number };
  createdAt: string;
}

export interface DripSequenceDetail extends DripSequence {
  enrollments: Array<{
    id: string;
    status: string;
    currentStep: number;
    lead: { id: string; name: string | null; phone: string };
    createdAt: string;
  }>;
}

// ============================================================================
// INTAKE API
// ============================================================================

export async function getLeads(params?: Record<string, string>) {
  const { data } = await api.get('/leads', { params });
  // API wraps as {data: {data: [...], meta: {...}}}
  const inner = data.data || data;
  return Array.isArray(inner) ? inner : inner.data || inner;
}

export async function getLead(id: string) {
  const { data } = await api.get(`/leads/${id}`);
  return data;
}

export async function updateLead(id: string, body: Partial<Lead>) {
  const { data } = await api.patch(`/leads/${id}`, body);
  return data;
}

export async function retryPayment(id: string) {
  const { data } = await api.post(`/leads/${id}/retry-payment`);
  return data;
}

export async function getStats(): Promise<Stats> {
  const { data } = await api.get('/stats');
  return data.data || data;
}

// ============================================================================
// CRM API — Tags
// ============================================================================

export async function getAllTags(): Promise<string[]> {
  const { data } = await crmApi.get('/tags');
  return data.data || data;
}

export async function addTagsToLead(leadId: string, tags: string[]) {
  const { data } = await crmApi.post(`/leads/${leadId}/tags`, { tags });
  return data;
}

export async function removeTagsFromLead(leadId: string, tags: string[]) {
  const { data } = await crmApi.delete(`/leads/${leadId}/tags`, { data: { tags } });
  return data;
}

export async function bulkAddTags(leadIds: string[], tags: string[]) {
  const { data } = await crmApi.post('/leads/bulk-tag', { leadIds, tags });
  return data;
}

// ============================================================================
// CRM API — Leads (segmented)
// ============================================================================

export async function getCrmLeads(params?: Record<string, string>): Promise<{
  data: CrmLead[];
  meta: { total: number; page: number; limit: number; pages: number };
}> {
  const { data } = await crmApi.get('/leads', { params });
  return data.data ? { data: data.data, meta: data.meta } : { data, meta: { total: 0, page: 1, limit: 50, pages: 1 } };
}

// ============================================================================
// CRM API — Sequences
// ============================================================================

export async function getSequences(): Promise<DripSequence[]> {
  const { data } = await crmApi.get('/sequences');
  return data.data || data;
}

export async function getSequence(id: string): Promise<DripSequenceDetail> {
  const { data } = await crmApi.get(`/sequences/${id}`);
  return data.data || data;
}

export async function createSequence(dto: { name: string; description?: string; trigger: string; triggerValue?: string }) {
  const { data } = await crmApi.post('/sequences', dto);
  return data.data || data;
}

export async function updateSequence(id: string, dto: { name?: string; description?: string; isActive?: boolean }) {
  const { data } = await crmApi.patch(`/sequences/${id}`, dto);
  return data.data || data;
}

export async function deleteSequence(id: string) {
  const { data } = await crmApi.delete(`/sequences/${id}`);
  return data;
}

// ============================================================================
// CRM API — Steps
// ============================================================================

export async function addStep(sequenceId: string, dto: { stepNumber: number; delayMinutes: number; channel: string; content: string }) {
  const { data } = await crmApi.post(`/sequences/${sequenceId}/steps`, dto);
  return data.data || data;
}

export async function updateStep(stepId: string, dto: { delayMinutes?: number; content?: string; isActive?: boolean }) {
  const { data } = await crmApi.patch(`/steps/${stepId}`, dto);
  return data.data || data;
}

export async function deleteStep(stepId: string) {
  const { data } = await crmApi.delete(`/steps/${stepId}`);
  return data;
}

// ============================================================================
// CRM API — Enrollments
// ============================================================================

export async function enrollLeads(sequenceId: string, leadIds: string[]) {
  const { data } = await crmApi.post(`/sequences/${sequenceId}/enroll`, { leadIds });
  return data;
}

export async function pauseEnrollment(enrollmentId: string) {
  const { data } = await crmApi.post(`/enrollments/${enrollmentId}/pause`);
  return data;
}

export async function resumeEnrollment(enrollmentId: string) {
  const { data } = await crmApi.post(`/enrollments/${enrollmentId}/resume`);
  return data;
}

export async function cancelEnrollment(enrollmentId: string) {
  const { data } = await crmApi.post(`/enrollments/${enrollmentId}/cancel`);
  return data;
}
