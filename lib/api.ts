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

export async function deleteLead(id: string) {
  const { data } = await crmApi.delete(`/leads/${id}`);
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
// CRM API — Crews
// ============================================================================

export interface CrewMember {
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

export interface Crew {
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
  members: CrewMember[];
  createdAt: string;
}

export async function generateCrews(params?: { city?: string; minSize?: number; maxSize?: number }): Promise<Crew[]> {
  const { data } = await crmApi.post('/crews/generate', params || {});
  return data.data || data;
}

export async function getCrews(params?: Record<string, string>): Promise<{ data: Crew[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const { data } = await crmApi.get('/crews', { params });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

export async function getCrew(id: string): Promise<Crew> {
  const { data } = await crmApi.get(`/crews/${id}`);
  return data.data || data;
}

export async function confirmCrew(id: string, dto: { eventDate: string; eventLocation?: string; eventNotes?: string }): Promise<Crew> {
  const { data } = await crmApi.post(`/crews/${id}/confirm`, dto);
  return data.data || data;
}

export async function sendCrewInvitations(id: string): Promise<Crew> {
  const { data } = await crmApi.post(`/crews/${id}/invite`);
  return data.data || data;
}

export async function createCrewEvent(id: string): Promise<Crew> {
  const { data } = await crmApi.post(`/crews/${id}/create-event`);
  return data.data || data;
}

export async function sendCrewReminders(id: string): Promise<Crew> {
  const { data } = await crmApi.post(`/crews/${id}/send-reminders`);
  return data.data || data;
}

export async function completeCrew(id: string) {
  const { data } = await crmApi.post(`/crews/${id}/complete`);
  return data.data || data;
}

export async function cancelCrew(id: string) {
  const { data } = await crmApi.post(`/crews/${id}/cancel`);
  return data.data || data;
}

export async function deleteCrew(id: string) {
  const { data } = await crmApi.delete(`/crews/${id}`);
  return data.data || data;
}

export async function addCrewMember(crewId: string, leadId: string) {
  const { data } = await crmApi.post(`/crews/${crewId}/members`, { leadId });
  return data.data || data;
}

export async function removeCrewMember(crewId: string, memberId: string) {
  const { data } = await crmApi.delete(`/crews/${crewId}/members/${memberId}`);
  return data.data || data;
}

export async function updateMemberRsvp(memberId: string, rsvpStatus: string, cancelReason?: string) {
  const { data } = await crmApi.patch(`/crew-members/${memberId}/rsvp`, { rsvpStatus, cancelReason });
  return data.data || data;
}

export async function markMemberAttendance(memberId: string, attended: boolean) {
  const { data } = await crmApi.patch(`/crew-members/${memberId}/attendance`, { attended });
  return data.data || data;
}

// ============================================================================
// CRM API — City Settings
// ============================================================================

export interface CitySettings {
  id: string;
  city: string;
  minConfirmed: number;
  defaultLocation: string | null;
  defaultNotes: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function getCitySettings(): Promise<CitySettings[]> {
  const { data } = await crmApi.get('/city-settings');
  return data.data || data;
}

export async function createCitySettings(dto: { city: string; minConfirmed?: number; defaultLocation?: string; defaultNotes?: string }): Promise<CitySettings> {
  const { data } = await crmApi.post('/city-settings', dto);
  return data.data || data;
}

export async function updateCitySettings(id: string, dto: { minConfirmed?: number; defaultLocation?: string; defaultNotes?: string; isActive?: boolean }): Promise<CitySettings> {
  const { data } = await crmApi.patch(`/city-settings/${id}`, dto);
  return data.data || data;
}

export async function deleteCitySettings(id: string) {
  const { data } = await crmApi.delete(`/city-settings/${id}`);
  return data.data || data;
}

// ============================================================================
// CRM API — Analytics
// ============================================================================

export interface FunnelStage { status: string; count: number; }
export interface FunnelData {
  stages: FunnelStage[];
  total: number;
  conversionRates: { infoToLink: number; linkToPaid: number; paidToMatched: number; overallConversion: number };
}

export interface SourceData { source: string; total: number; matched: number; conversionRate: number; }
export interface CrewFunnelStage { stage: string; count: number; }

export async function getFunnelData(): Promise<FunnelData> {
  const { data } = await crmApi.get('/analytics/funnel');
  return data.data || data;
}

export async function getSourceAttribution(): Promise<SourceData[]> {
  const { data } = await crmApi.get('/analytics/source');
  return data.data || data;
}

export async function getCrewFunnel(): Promise<{ stages: CrewFunnelStage[] }> {
  const { data } = await crmApi.get('/analytics/crew-funnel');
  return data.data || data;
}

// ============================================================================
// CRM API — Timeline
// ============================================================================

export interface TimelineEntry {
  type: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export async function getLeadTimeline(leadId: string, page = 1, type?: string): Promise<{ data: TimelineEntry[]; meta: any }> {
  const params: Record<string, string> = { page: String(page) };
  if (type && type !== 'all') params.type = type;
  const { data } = await crmApi.get(`/leads/${leadId}/timeline`, { params });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

// ============================================================================
// CRM API — Waitlist
// ============================================================================

export async function getWaitlist(city?: string) {
  const params = city ? { city } : {};
  const { data } = await crmApi.get('/waitlist', { params });
  return data.data || data;
}

export async function assignWaitlistToCrew(leadId: string, crewId: string) {
  const { data } = await crmApi.post(`/waitlist/${leadId}/assign/${crewId}`);
  return data.data || data;
}

// ============================================================================
// CRM API — Automation Analytics
// ============================================================================

export interface AutomationAnalytics { id: string; name: string; trigger: string; total: number; sent: number; failed: number; deliveryRate: number; }

export async function getAutomationAnalytics(): Promise<AutomationAnalytics[]> {
  const { data } = await crmApi.get('/automations/analytics');
  return data.data || data;
}

// ============================================================================
// CRM API — Engagement Score
// ============================================================================

export async function getEngagementScore(leadId: string): Promise<{ leadId: string; engagementScore: number }> {
  const { data } = await crmApi.get(`/leads/${leadId}/engagement`);
  return data.data || data;
}

export async function recalculateScores() {
  const { data } = await crmApi.post('/scores/recalculate');
  return data.data || data;
}

// ============================================================================
// CRM API — Availability
// ============================================================================

export async function updateLeadAvailability(leadId: string, preferredDays: string[]) {
  const { data } = await crmApi.patch(`/leads/${leadId}/availability`, { preferredDays });
  return data.data || data;
}

// ============================================================================
// CRM API — Crew Chat
// ============================================================================

export interface ChatMessage { id: string; chatId: string; leadId: string | null; lead: { id: string; name: string } | null; isSystem: boolean; content: string; createdAt: string; }

export async function getCrewChat(crewId: string, page = 1): Promise<{ data: ChatMessage[]; meta: any }> {
  const { data } = await crmApi.get(`/crews/${crewId}/chat`, { params: { page: String(page) } });
  const inner = data.data || data;
  if (Array.isArray(inner)) return { data: inner, meta: { total: inner.length, page: 1, limit: 50, pages: 1 } };
  return { data: inner.data || [], meta: inner.meta || { total: 0, page: 1, limit: 50, pages: 1 } };
}

export async function sendCrewChatMessage(crewId: string, content: string, leadId?: string) {
  const { data } = await crmApi.post(`/crews/${crewId}/chat`, { content, leadId });
  return data.data || data;
}

// ============================================================================
// CRM API — NPS
// ============================================================================

export interface NpsResults { totalResponses: number; averageScore: number; nps: number; distribution: Array<{ score: number; count: number }>; }

export async function getNpsResults(crewId?: string, city?: string): Promise<NpsResults> {
  const params: Record<string, string> = {};
  if (crewId) params.crewId = crewId;
  if (city) params.city = city;
  const { data } = await crmApi.get('/nps', { params });
  return data.data || data;
}

export async function sendNpsSurveys(crewId: string) {
  const { data } = await crmApi.post(`/crews/${crewId}/send-nps`);
  return data.data || data;
}

export async function respondNps(surveyId: string, score: number, feedback?: string) {
  const { data } = await crmApi.post(`/nps/${surveyId}/respond`, { score, feedback });
  return data.data || data;
}

// ============================================================================
// CRM API — Recurring Crews
// ============================================================================

export async function recreateCrew(crewId: string): Promise<Crew> {
  const { data } = await crmApi.post(`/crews/${crewId}/recreate`);
  return data.data || data;
}
