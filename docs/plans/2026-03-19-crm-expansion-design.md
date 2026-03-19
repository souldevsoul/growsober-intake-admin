# CRM Feature Expansion Design

## Goal

Expand the GrowSober admin CRM from a basic leads table into a full-featured CRM with lead detail pages, activity tracking, kanban pipeline, SMS conversations, scheduled messages, saved segments, lead scoring, and payment tracking.

## Features Overview

| # | Feature | Effort | New Models | New Endpoints |
|---|---------|--------|------------|---------------|
| 1 | Lead Detail Page | Medium | - | GET /crm/leads/:id |
| 2 | Notes/Activity Log | Medium | LeadActivity | GET/POST activity & notes |
| 3 | Kanban Pipeline View | Medium | - | Uses existing PATCH |
| 4 | SMS Conversation View | Low | - (uses existing SmsMessage) | GET/POST sms |
| 5 | Scheduled Messages | Medium | ScheduledMessage | CRUD + queue page |
| 6 | Saved Segments | Low | SavedSegment | CRUD segments |
| 7 | Lead Scoring | Low | - (computed) | - |
| 8 | Payment Tracking | Low | - (uses existing fields) | - |

---

## 1. Lead Detail Page

**Route**: `/crm/leads/:id` — full page, reached by clicking any lead row.

**Layout** (stacked sections):

1. **Header** — name, phone, status badge (editable dropdown), source badge, lead score, created date, back button
2. **Quick info cards** — city, sobriety status, interests, tags (editable inline)
3. **Notes/Activity Log** — reverse-chronological timeline (section 2)
4. **SMS Conversation** — chat bubble UI (section 4)
5. **Drip Enrollments** — all enrollments with sequence name, current step, status, pause/resume/cancel
6. **Payment** — paid/unpaid badge, date, Stripe link (section 8)

**API**: Needs a `GET /crm/leads/:id` endpoint returning the full lead with relations (tags, enrollments with sequence info, sms messages, activities).

---

## 2. Notes/Activity Log

**New Prisma Model: `LeadActivity`**

```prisma
model LeadActivity {
  id        String   @id @default(uuid())
  leadId    String
  lead      PhoneIntakeLead @relation(fields: [leadId], references: [id])
  type      ActivityType
  content   String
  metadata  Json?
  createdBy String   @default("system")
  createdAt DateTime @default(now())

  @@index([leadId, createdAt])
}

enum ActivityType {
  NOTE
  STATUS_CHANGE
  TAG_ADDED
  TAG_REMOVED
  ENROLLED
  UNENROLLED
  PAYMENT
  SMS_SENT
  SMS_RECEIVED
}
```

**API Endpoints**:
- `GET /crm/leads/:id/activity` — paginated activity feed (newest first)
- `POST /crm/leads/:id/notes` — add manual note `{ content: string }`

**Auto-logging**: Existing mutation endpoints (status change, tag add/remove, enrollment actions) will create LeadActivity records as side effects.

**UI**: Reverse-chronological timeline. System events show icon + description ("Status changed from CALLED to INFO_COLLECTED"). Manual notes show text with timestamp. Text input at top to add new notes.

---

## 3. Kanban Pipeline View

**Toggle on CRM Leads page**: "Table | Pipeline" button group in the filter bar.

**Columns** (left to right):
- CALLED
- INFO_COLLECTED
- LINK_SENT
- PAID
- MATCHED
- FAILED

**Card contents**: Lead name, phone, top tag (if any), time in current stage.

**Drag-and-drop**: Dragging a card between columns calls `PATCH /phone-intake/admin/leads/:id` with new status. Column headers show count badge.

**Library**: `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd).

**Filters**: Same search/source/tag filters apply — filtered-out leads are hidden from the board.

---

## 4. SMS Conversation View

**Location**: Section on Lead Detail page.

**Data source**: Existing `SmsMessage` model (linked via `SmsConversation` → `PhoneIntakeLead`).

**UI**: Chat bubble layout:
- Inbound (FROM lead): left-aligned, gray background
- Outbound (TO lead): right-aligned, blue background
- Each bubble shows message text + timestamp

**Compose box** at bottom:
- Text input (textarea)
- "Send" button — sends immediately via Twilio
- "Schedule" toggle — reveals date/time picker, creates ScheduledMessage instead

**API Endpoints**:
- `GET /crm/leads/:id/sms` — get all SMS messages for this lead (via SmsConversation)
- `POST /crm/leads/:id/sms` — send SMS immediately `{ message: string }`
- `POST /crm/leads/:id/sms/schedule` — schedule SMS `{ message: string, scheduledAt: ISO string }`

---

## 5. Scheduled Messages

**New Prisma Model: `ScheduledMessage`**

```prisma
model ScheduledMessage {
  id          String   @id @default(uuid())
  leadId      String
  lead        PhoneIntakeLead @relation(fields: [leadId], references: [id])
  content     String
  channel     DripChannel @default(SMS)
  scheduledAt DateTime
  status      ScheduledMessageStatus @default(PENDING)
  sentAt      DateTime?
  error       String?
  createdAt   DateTime @default(now())

  @@index([status, scheduledAt])
  @@index([leadId])
}

enum ScheduledMessageStatus {
  PENDING
  SENT
  CANCELLED
  FAILED
}
```

**Queue Page**: `/crm/scheduled`
- Table: lead name, phone, message preview (truncated), scheduled time, status badge
- Actions: Cancel (PENDING only), Edit (PENDING only), Send Now (PENDING only)
- Filters: status (All / Pending / Sent / Cancelled)

**Background Job**: Cron job runs every minute. Finds `ScheduledMessage` where `scheduledAt <= now()` and `status = PENDING`. Sends via Twilio, updates status to SENT or FAILED.

**API Endpoints**:
- `GET /crm/scheduled` — list scheduled messages with pagination
- `PATCH /crm/scheduled/:id` — update (content, scheduledAt) or cancel
- `DELETE /crm/scheduled/:id` — cancel scheduled message
- `POST /crm/scheduled/:id/send-now` — send immediately

**Sidebar**: New "Scheduled" link in sidebar nav.

---

## 6. Saved Segments

**New Prisma Model: `SavedSegment`**

```prisma
model SavedSegment {
  id        String   @id @default(uuid())
  name      String
  filters   Json
  createdAt DateTime @default(now())
}
```

`filters` JSON shape:
```json
{
  "status": "INFO_COLLECTED",
  "source": "SMS",
  "tags": ["founding-crew"],
  "city": "London",
  "search": ""
}
```

**API Endpoints**:
- `GET /crm/segments` — list all segments (includes live count per segment by running filter query)
- `POST /crm/segments` — create `{ name, filters }`
- `DELETE /crm/segments/:id` — delete segment

**UI**: Row of pill buttons above the filter bar on CRM Leads page. Each shows segment name + count badge (e.g., "London Crew (7)"). Clicking applies those filters. "Save filters" button appears when filters are active.

---

## 7. Lead Scoring

**Computed on read** — no stored field. Calculated when lead data is fetched.

**Score: 0–100**

| Signal | Points |
|--------|--------|
| Status: PAID | +40 |
| Status: MATCHED | +50 |
| Enrolled in drip sequence | +15 |
| Per drip step completed | +5 (max +15) |
| Has name | +5 |
| Has city | +5 |
| Has interests | +5 |
| Created in last 3 days | +10 |
| Created in last 7 days | +5 |
| Has replied to SMS | +10 |

**UI**:
- Color-coded score badge on lead rows (green 70+, yellow 40-69, gray 0-39)
- Score shown in lead detail header
- "Sort by score" option in table view

**Implementation**: Scoring function in a shared utility. API includes `score` field in lead responses.

---

## 8. Payment Tracking

**No new models** — uses existing PhoneIntakeLead fields: `paymentIntentId`, `checkoutSessionId`, `stripePaymentId`, `paidAt`, `status`.

**UI on Lead Detail page** (Payment section):
- **Paid**: Green badge, paidAt date, "View in Stripe" link → `https://dashboard.stripe.com/payments/{paymentIntentId}`
- **Unpaid + INFO_COLLECTED**: Gray badge, "Send Payment Link" button (calls existing retry-payment endpoint)
- **Failed**: Red badge, failReason if available, "Retry Payment" button

---

## New Sidebar Navigation

```
GrowSober
├── Dashboard       /
├── CRM Leads       /crm          (table + kanban toggle)
├── Drip Sequences  /crm/sequences
├── Scheduled       /crm/scheduled
```

Lead detail at `/crm/leads/:id` (no sidebar link — accessed by clicking a lead row).

---

## Data Flow Summary

```
Lead Row Click → /crm/leads/:id
                  ├── GET /crm/leads/:id (full lead + relations)
                  ├── GET /crm/leads/:id/activity (timeline)
                  ├── GET /crm/leads/:id/sms (conversation)
                  └── POST /crm/leads/:id/notes (add note)
                  └── POST /crm/leads/:id/sms (send message)
                  └── POST /crm/leads/:id/sms/schedule (schedule)

Kanban Drag → PATCH /phone-intake/admin/leads/:id { status }
              + POST /crm/leads/:id/activity (auto-log)

Segments → GET /crm/segments (with live counts)
Scheduled → GET /crm/scheduled (queue)
```

---

## Dependencies

- `@hello-pangea/dnd` — drag-and-drop for kanban
- No other new dependencies needed

## Migration Summary

New Prisma models:
1. `LeadActivity` — activity/notes log
2. `ScheduledMessage` — scheduled SMS queue
3. `SavedSegment` — saved filter segments

New relation on `PhoneIntakeLead`:
- `activities LeadActivity[]`
- `scheduledMessages ScheduledMessage[]`
