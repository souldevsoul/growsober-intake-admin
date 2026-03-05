import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const API_KEY = process.env.NEXT_PUBLIC_INTAKE_API_KEY || '';

export const api = axios.create({
  baseURL: `${API_BASE}/phone-intake/admin`,
  headers: { 'x-api-key': API_KEY },
});

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

export async function getLeads(params?: Record<string, string>) {
  const { data } = await api.get('/leads', { params });
  return data;
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
