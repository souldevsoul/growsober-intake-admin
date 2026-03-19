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
  // API double-wraps: {data: {data: [...], meta: {...}}, meta: {...}}
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: data.meta || { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
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

// ============================================================================
// CRM EXPANSION TYPES
// ============================================================================

export interface LeadDetail extends CrmLead {
  score: number;
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  stripePaymentId: string | null;
  sobrietyStatus: string | null;
  interests: string[];
  smsConversations: Array<{
    id: string;
    messages: SmsMessage[];
  }>;
}

export interface SmsMessage {
  id: string;
  body: string;
  direction: 'IN' | 'OUT';
  createdAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
}

export interface ScheduledMessage {
  id: string;
  leadId: string;
  lead: { id: string; name: string | null; phone: string };
  content: string;
  channel: string;
  scheduledAt: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  sentAt: string | null;
  createdAt: string;
}

export interface SavedSegment {
  id: string;
  name: string;
  filters: Record<string, string>;
  count: number;
  createdAt: string;
}

// ============================================================================
// CRM API — Lead Detail
// ============================================================================

export async function getCrmLead(id: string): Promise<LeadDetail> {
  const { data } = await crmApi.get(`/leads/${id}`);
  return data.data || data;
}

// ============================================================================
// CRM API — Activity
// ============================================================================

export async function getLeadActivity(leadId: string, page = 1): Promise<{
  data: LeadActivity[];
  meta: { total: number; page: number; limit: number; pages: number };
}> {
  const { data } = await crmApi.get(`/leads/${leadId}/activity`, { params: { page } });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

export async function addLeadNote(leadId: string, content: string) {
  const { data } = await crmApi.post(`/leads/${leadId}/notes`, { content });
  return data;
}

// ============================================================================
// CRM API — SMS
// ============================================================================

export async function getLeadSms(leadId: string): Promise<SmsMessage[]> {
  const { data } = await crmApi.get(`/leads/${leadId}/sms`);
  return data.data || data;
}

export async function sendLeadSms(leadId: string, message: string) {
  const { data } = await crmApi.post(`/leads/${leadId}/sms`, { message });
  return data;
}

export async function scheduleLeadSms(leadId: string, message: string, scheduledAt: string) {
  const { data } = await crmApi.post(`/leads/${leadId}/sms/schedule`, { message, scheduledAt });
  return data;
}

// ============================================================================
// CRM API — Scheduled Messages
// ============================================================================

export async function getScheduledMessages(params?: Record<string, string>): Promise<{
  data: ScheduledMessage[];
  meta: { total: number; page: number; limit: number; pages: number };
}> {
  const { data } = await crmApi.get('/scheduled', { params });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

export async function cancelScheduledMessage(id: string) {
  const { data } = await crmApi.delete(`/scheduled/${id}`);
  return data;
}

export async function sendScheduledNow(id: string) {
  const { data } = await crmApi.post(`/scheduled/${id}/send-now`);
  return data;
}

// ============================================================================
// CRM API — Segments
// ============================================================================

export async function getSegments(): Promise<SavedSegment[]> {
  const { data } = await crmApi.get('/segments');
  return data.data || data;
}

export async function createSegment(name: string, filters: Record<string, string>) {
  const { data } = await crmApi.post('/segments', { name, filters });
  return data;
}

export async function deleteSegment(id: string) {
  const { data } = await crmApi.delete(`/segments/${id}`);
  return data;
}

// ============================================================================
// CRM API — Automations
// ============================================================================

export interface CrmAutomation {
  id: string;
  name: string;
  trigger: string;
  triggerConfig: Record<string, unknown> | null;
  channel: string;
  messageTemplate: string;
  isActive: boolean;
  _count?: { logs: number };
  createdAt: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  automation?: { name: string; trigger: string };
  leadId: string | null;
  trigger: string;
  channel: string;
  renderedMessage: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  createdAt: string;
}

export async function getAutomations(): Promise<CrmAutomation[]> {
  const { data } = await crmApi.get('/automations');
  return data.data || data;
}

export async function createAutomation(dto: { name: string; trigger: string; triggerConfig?: Record<string, unknown>; channel: string; messageTemplate: string; isActive?: boolean }): Promise<CrmAutomation> {
  const { data } = await crmApi.post('/automations', dto);
  return data.data || data;
}

export async function updateAutomation(id: string, dto: { name?: string; triggerConfig?: Record<string, unknown>; channel?: string; messageTemplate?: string; isActive?: boolean }): Promise<CrmAutomation> {
  const { data } = await crmApi.patch(`/automations/${id}`, dto);
  return data.data || data;
}

export async function deleteAutomation(id: string) {
  const { data } = await crmApi.delete(`/automations/${id}`);
  return data.data || data;
}

export async function getAutomationLogs(params?: Record<string, string>): Promise<{ data: AutomationLog[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const { data } = await crmApi.get('/automation-logs', { params });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

// ============================================================================
// CRM API — Cohorts
// ============================================================================

export interface CohortMember {
  id: string;
  cohortId: string;
  leadId: string;
  lead: { id: string; name: string | null; phone: string; city?: string | null; interests?: string[]; sobrietyStatus?: string | null };
  rsvpStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
  rsvpAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  reminderSent: boolean;
  attended: boolean;
}

export interface Cohort {
  id: string;
  name: string;
  status: 'DRAFT' | 'CONFIRMED' | 'INVITED' | 'EVENT_CREATED' | 'COMPLETED' | 'CANCELLED';
  city: string | null;
  hubId: string | null;
  hub: { id: string; name: string } | null;
  eventId: string | null;
  event: { id: string; title: string; startDate: string; status: string; locationName?: string } | null;
  eventDate: string | null;
  eventLocation: string | null;
  eventNotes: string | null;
  invitedAt: string | null;
  reminderSentAt: string | null;
  members: CohortMember[];
  createdAt: string;
}

export async function generateCohorts(params?: { city?: string; minSize?: number; maxSize?: number }): Promise<Cohort[]> {
  const { data } = await crmApi.post('/cohorts/generate', params || {});
  return data.data || data;
}

export async function getCohorts(params?: Record<string, string>): Promise<{ data: Cohort[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const { data } = await crmApi.get('/cohorts', { params });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

export async function getCohort(id: string): Promise<Cohort> {
  const { data } = await crmApi.get(`/cohorts/${id}`);
  return data.data || data;
}

export async function confirmCohort(id: string, dto: { eventDate: string; eventLocation?: string; eventNotes?: string }): Promise<Cohort> {
  const { data } = await crmApi.post(`/cohorts/${id}/confirm`, dto);
  return data.data || data;
}

export async function sendCohortInvitations(id: string): Promise<Cohort> {
  const { data } = await crmApi.post(`/cohorts/${id}/invite`);
  return data.data || data;
}

export async function createCohortEvent(id: string): Promise<Cohort> {
  const { data } = await crmApi.post(`/cohorts/${id}/create-event`);
  return data.data || data;
}

export async function sendCohortReminders(id: string): Promise<Cohort> {
  const { data } = await crmApi.post(`/cohorts/${id}/send-reminders`);
  return data.data || data;
}

export async function completeCohort(id: string) {
  const { data } = await crmApi.post(`/cohorts/${id}/complete`);
  return data.data || data;
}

export async function cancelCohort(id: string) {
  const { data } = await crmApi.post(`/cohorts/${id}/cancel`);
  return data.data || data;
}

export async function deleteCohort(id: string) {
  const { data } = await crmApi.delete(`/cohorts/${id}`);
  return data.data || data;
}

export async function addCohortMember(cohortId: string, leadId: string) {
  const { data } = await crmApi.post(`/cohorts/${cohortId}/members`, { leadId });
  return data.data || data;
}

export async function removeCohortMember(cohortId: string, memberId: string) {
  const { data } = await crmApi.delete(`/cohorts/${cohortId}/members/${memberId}`);
  return data.data || data;
}

export async function updateMemberRsvp(memberId: string, rsvpStatus: string, cancelReason?: string) {
  const { data } = await crmApi.patch(`/cohort-members/${memberId}/rsvp`, { rsvpStatus, cancelReason });
  return data.data || data;
}

export async function markMemberAttendance(memberId: string, attended: boolean) {
  const { data } = await crmApi.patch(`/cohort-members/${memberId}/attendance`, { attended });
  return data.data || data;
}
