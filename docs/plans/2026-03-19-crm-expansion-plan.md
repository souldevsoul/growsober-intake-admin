# CRM Feature Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the GrowSober admin CRM with lead detail pages, activity log, kanban pipeline, SMS conversations, scheduled messages, saved segments, lead scoring, and payment tracking.

**Architecture:** Backend-first approach. Add 3 new Prisma models (LeadActivity, ScheduledMessage, SavedSegment) and new API endpoints to the existing CRM module. Then build frontend pages consuming those endpoints. Lead scoring is computed on read (no stored field).

**Tech Stack:** NestJS + Prisma (API), Next.js + React + shadcn/ui + Tailwind (admin), @hello-pangea/dnd (kanban drag-and-drop)

**Repos:**
- API: `/Users/rentamac/Projects/growsober/growsober-api`
- Admin: `/Users/rentamac/Projects/growsober/growsober-intake-admin`

---

### Task 1: Prisma Schema — Add LeadActivity, ScheduledMessage, SavedSegment models

**Files:**
- Modify: `growsober-api/prisma/schema.prisma`

**Step 1: Add the three new models and enums to schema.prisma**

Add after the existing `DripDelivery` model:

```prisma
// ============================================================================
// CRM Expansion Models
// ============================================================================

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

model LeadActivity {
  id        String       @id @default(uuid())
  leadId    String
  lead      PhoneIntakeLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type      ActivityType
  content   String
  metadata  Json?
  createdBy String       @default("system")
  createdAt DateTime     @default(now())

  @@index([leadId, createdAt])
  @@map("lead_activities")
}

enum ScheduledMessageStatus {
  PENDING
  SENT
  CANCELLED
  FAILED
}

model ScheduledMessage {
  id          String                 @id @default(uuid())
  leadId      String
  lead        PhoneIntakeLead        @relation(fields: [leadId], references: [id], onDelete: Cascade)
  content     String
  channel     DripChannel            @default(SMS)
  scheduledAt DateTime
  status      ScheduledMessageStatus @default(PENDING)
  sentAt      DateTime?
  error       String?
  createdAt   DateTime               @default(now())

  @@index([status, scheduledAt])
  @@index([leadId])
  @@map("scheduled_messages")
}

model SavedSegment {
  id        String   @id @default(uuid())
  name      String
  filters   Json
  createdAt DateTime @default(now())

  @@map("saved_segments")
}
```

**Step 2: Add relations to PhoneIntakeLead model**

Find the `PhoneIntakeLead` model in schema.prisma and add these two relation fields alongside the existing `dripEnrollments` and `smsConversations`:

```prisma
  activities        LeadActivity[]
  scheduledMessages ScheduledMessage[]
```

**Step 3: Generate migration and apply**

Run from `growsober-api/`:
```bash
npx prisma migrate dev --name add-crm-expansion-models
```
Expected: Migration created and applied, Prisma client regenerated.

**Step 4: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
git add prisma/
git commit -m "feat: add LeadActivity, ScheduledMessage, SavedSegment models"
```

---

### Task 2: API — Lead Activity service and endpoints

**Files:**
- Create: `growsober-api/src/modules/crm/activity.service.ts`
- Modify: `growsober-api/src/modules/crm/dto/index.ts`
- Modify: `growsober-api/src/modules/crm/crm-admin.controller.ts`
- Modify: `growsober-api/src/modules/crm/crm.module.ts`

**Step 1: Add DTOs to `dto/index.ts`**

Add at the bottom of the file:

```typescript
// ============================================================================
// Activity DTOs
// ============================================================================

export class CreateNoteDto {
  @ApiProperty({ example: 'Called, left voicemail. Will follow up Thursday.' })
  @IsString()
  content: string;
}

export class QueryActivityDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
```

**Step 2: Create `activity.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { ActivityType } from '@prisma/client';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getActivities(leadId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.leadActivity.count({ where: { leadId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async addNote(leadId: string, content: string) {
    return this.prisma.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.NOTE,
        content,
        createdBy: 'admin',
      },
    });
  }

  async log(
    leadId: string,
    type: ActivityType,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.leadActivity.create({
      data: {
        leadId,
        type,
        content,
        metadata: metadata ?? undefined,
        createdBy: 'system',
      },
    });
  }
}
```

**Step 3: Add routes to `crm-admin.controller.ts`**

Import `ActivityService` and add to constructor. Add these routes in a new "Activity" section:

```typescript
// At the top, add imports:
import { ActivityService } from './activity.service';
import { CreateNoteDto, QueryActivityDto } from './dto';

// Add to constructor:
constructor(
  private readonly crmService: CrmService,
  private readonly dripService: DripService,
  private readonly activityService: ActivityService,
) {}

// Add new section after Tags section:

// ============================================================================
// Activity / Notes
// ============================================================================

@Get('leads/:id/activity')
@ApiOperation({ summary: 'Get activity feed for a lead' })
async getActivity(
  @Param('id') id: string,
  @Query() dto: QueryActivityDto,
) {
  return this.activityService.getActivities(id, dto.page, dto.limit);
}

@Post('leads/:id/notes')
@ApiOperation({ summary: 'Add a note to a lead' })
async addNote(@Param('id') id: string, @Body() dto: CreateNoteDto) {
  return this.activityService.addNote(id, dto.content);
}
```

**Step 4: Add a `GET leads/:id` route for the lead detail page**

Add this route in the Segmentation section (BEFORE the `@Get('leads')` route so NestJS matches it first):

```typescript
@Get('leads/:id')
@ApiOperation({ summary: 'Get a single lead with all relations' })
async getLeadById(@Param('id') id: string) {
  return this.crmService.getLeadById(id);
}
```

**Step 5: Add `getLeadById` to `crm.service.ts`**

```typescript
async getLeadById(id: string) {
  return this.prisma.phoneIntakeLead.findUniqueOrThrow({
    where: { id },
    include: {
      hub: { select: { id: true, name: true } },
      dripEnrollments: {
        include: {
          sequence: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      smsConversations: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}
```

**Step 6: Register ActivityService in `crm.module.ts`**

Add `ActivityService` to providers and exports arrays.

**Step 7: Wire up auto-logging in existing mutation methods**

In `crm.service.ts`, inject `ActivityService` and add logging calls:

- `addTags()`: after updating, call `this.activityService.log(leadId, 'TAG_ADDED', 'Tags added: ' + newTags.join(', '))`
- `removeTags()`: after updating, call `this.activityService.log(leadId, 'TAG_REMOVED', 'Tags removed: ' + tags.join(', '))`

In `drip.service.ts`, inject `ActivityService` and add:
- `enrollMany()`: log `ENROLLED` for each lead
- `pauseEnrollment()`: log with enrollment details
- `resumeEnrollment()`: log
- `cancelEnrollment()`: log

**Step 8: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
git add src/modules/crm/
git commit -m "feat: add activity log service, lead detail endpoint, auto-logging"
```

---

### Task 3: API — SMS endpoints and Scheduled Messages

**Files:**
- Create: `growsober-api/src/modules/crm/scheduled-message.service.ts`
- Create: `growsober-api/src/modules/crm/scheduled-message-processor.job.ts`
- Modify: `growsober-api/src/modules/crm/dto/index.ts`
- Modify: `growsober-api/src/modules/crm/crm-admin.controller.ts`
- Modify: `growsober-api/src/modules/crm/crm.module.ts`

**Step 1: Add DTOs to `dto/index.ts`**

```typescript
// ============================================================================
// SMS & Scheduled Message DTOs
// ============================================================================

export class SendSmsDto {
  @ApiProperty({ example: 'Hey! Just checking in.' })
  @IsString()
  message: string;
}

export class ScheduleSmsDto {
  @ApiProperty({ example: 'Reminder: your session is tomorrow!' })
  @IsString()
  message: string;

  @ApiProperty({ example: '2026-03-20T10:00:00Z' })
  @IsString()
  scheduledAt: string;
}

export class UpdateScheduledMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class QueryScheduledDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'SENT', 'CANCELLED', 'FAILED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
```

**Step 2: Create `scheduled-message.service.ts`**

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { TwilioService } from '@modules/auth/twilio.service';
import { ActivityService } from './activity.service';
import { ScheduledMessageStatus } from '@prisma/client';

@Injectable()
export class ScheduledMessageService {
  private readonly logger = new Logger(ScheduledMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
    private readonly activityService: ActivityService,
  ) {}

  async getSmsHistory(leadId: string) {
    const conversations = await this.prisma.smsConversation.findMany({
      where: { leadId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return conversations.flatMap((c) => c.messages);
  }

  async sendSms(leadId: string, message: string) {
    const lead = await this.prisma.phoneIntakeLead.findUniqueOrThrow({
      where: { id: leadId },
      select: { phone: true, name: true },
    });

    await this.twilioService.sendSms(lead.phone, message);
    await this.activityService.log(leadId, 'SMS_SENT', message);
    return { success: true };
  }

  async scheduleSms(leadId: string, message: string, scheduledAt: string) {
    return this.prisma.scheduledMessage.create({
      data: {
        leadId,
        content: message,
        scheduledAt: new Date(scheduledAt),
      },
    });
  }

  async listScheduled(status?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as ScheduledMessageStatus } : {};

    const [data, total] = await Promise.all([
      this.prisma.scheduledMessage.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.scheduledMessage.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async updateScheduled(id: string, content?: string, scheduledAt?: string) {
    const msg = await this.prisma.scheduledMessage.findUniqueOrThrow({
      where: { id },
    });
    if (msg.status !== 'PENDING') {
      throw new NotFoundException('Can only update pending messages');
    }
    return this.prisma.scheduledMessage.update({
      where: { id },
      data: {
        ...(content && { content }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      },
    });
  }

  async cancelScheduled(id: string) {
    return this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async sendNow(id: string) {
    const msg = await this.prisma.scheduledMessage.findUniqueOrThrow({
      where: { id },
      include: { lead: { select: { phone: true } } },
    });
    if (msg.status !== 'PENDING') {
      throw new NotFoundException('Can only send pending messages');
    }

    try {
      await this.twilioService.sendSms(msg.lead.phone, msg.content);
      await this.activityService.log(msg.leadId, 'SMS_SENT', msg.content);
      return this.prisma.scheduledMessage.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err) {
      return this.prisma.scheduledMessage.update({
        where: { id },
        data: { status: 'FAILED', error: err.message },
      });
    }
  }

  async processDueMessages() {
    const due = await this.prisma.scheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() },
      },
      include: { lead: { select: { phone: true } } },
    });

    for (const msg of due) {
      try {
        await this.twilioService.sendSms(msg.lead.phone, msg.content);
        await this.activityService.log(msg.leadId, 'SMS_SENT', msg.content);
        await this.prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Failed to send scheduled message ${msg.id}: ${err.message}`);
        await this.prisma.scheduledMessage.update({
          where: { id: msg.id },
          data: { status: 'FAILED', error: err.message },
        });
      }
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} scheduled messages`);
    }
  }
}
```

**Step 3: Create `scheduled-message-processor.job.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledMessageService } from './scheduled-message.service';

@Injectable()
export class ScheduledMessageProcessorJob {
  private readonly logger = new Logger(ScheduledMessageProcessorJob.name);
  private isProcessing = false;

  constructor(private readonly scheduledMessageService: ScheduledMessageService) {}

  @Cron('* * * * *')
  async handleScheduledMessages() {
    if (this.isProcessing) {
      this.logger.warn('Scheduled message processor already running, skipping');
      return;
    }
    this.isProcessing = true;
    try {
      await this.scheduledMessageService.processDueMessages();
    } finally {
      this.isProcessing = false;
    }
  }
}
```

**Step 4: Add routes to `crm-admin.controller.ts`**

Import `ScheduledMessageService` and new DTOs. Add to constructor. Add routes:

```typescript
// ============================================================================
// SMS
// ============================================================================

@Get('leads/:id/sms')
@ApiOperation({ summary: 'Get SMS history for a lead' })
async getSmsHistory(@Param('id') id: string) {
  return this.scheduledMessageService.getSmsHistory(id);
}

@Post('leads/:id/sms')
@ApiOperation({ summary: 'Send SMS to a lead immediately' })
async sendSms(@Param('id') id: string, @Body() dto: SendSmsDto) {
  return this.scheduledMessageService.sendSms(id, dto.message);
}

@Post('leads/:id/sms/schedule')
@ApiOperation({ summary: 'Schedule SMS for a lead' })
async scheduleSms(@Param('id') id: string, @Body() dto: ScheduleSmsDto) {
  return this.scheduledMessageService.scheduleSms(id, dto.message, dto.scheduledAt);
}

// ============================================================================
// Scheduled Messages
// ============================================================================

@Get('scheduled')
@ApiOperation({ summary: 'List scheduled messages' })
async listScheduled(@Query() dto: QueryScheduledDto) {
  return this.scheduledMessageService.listScheduled(dto.status, dto.page, dto.limit);
}

@Patch('scheduled/:id')
@ApiOperation({ summary: 'Update a scheduled message' })
async updateScheduled(@Param('id') id: string, @Body() dto: UpdateScheduledMessageDto) {
  return this.scheduledMessageService.updateScheduled(id, dto.content, dto.scheduledAt);
}

@Delete('scheduled/:id')
@ApiOperation({ summary: 'Cancel a scheduled message' })
async cancelScheduled(@Param('id') id: string) {
  return this.scheduledMessageService.cancelScheduled(id);
}

@Post('scheduled/:id/send-now')
@ApiOperation({ summary: 'Send a scheduled message immediately' })
async sendScheduledNow(@Param('id') id: string) {
  return this.scheduledMessageService.sendNow(id);
}
```

**Step 5: Register in `crm.module.ts`**

Add `ScheduledMessageService` and `ScheduledMessageProcessorJob` to providers. Import `AuthModule` (for TwilioService) if not already imported.

**Step 6: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
git add src/modules/crm/
git commit -m "feat: add SMS endpoints, scheduled messages service and cron processor"
```

---

### Task 4: API — Saved Segments endpoints

**Files:**
- Create: `growsober-api/src/modules/crm/segment.service.ts`
- Modify: `growsober-api/src/modules/crm/dto/index.ts`
- Modify: `growsober-api/src/modules/crm/crm-admin.controller.ts`
- Modify: `growsober-api/src/modules/crm/crm.module.ts`

**Step 1: Add DTOs to `dto/index.ts`**

```typescript
// ============================================================================
// Saved Segment DTOs
// ============================================================================

export class CreateSegmentDto {
  @ApiProperty({ example: 'London Founding Crew' })
  @IsString()
  name: string;

  @ApiProperty({ example: { status: 'INFO_COLLECTED', tags: ['founding-crew'], city: 'London' } })
  filters: Record<string, unknown>;
}
```

**Step 2: Create `segment.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { CrmService } from './crm.service';

@Injectable()
export class SegmentService {
  private readonly logger = new Logger(SegmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
  ) {}

  async listSegments() {
    const segments = await this.prisma.savedSegment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Compute live counts for each segment
    const withCounts = await Promise.all(
      segments.map(async (seg) => {
        const filters = seg.filters as Record<string, unknown>;
        const { count } = await this.crmService.getSegmentStats(filters as any);
        return { ...seg, count };
      }),
    );

    return withCounts;
  }

  async createSegment(name: string, filters: Record<string, unknown>) {
    return this.prisma.savedSegment.create({
      data: { name, filters },
    });
  }

  async deleteSegment(id: string) {
    return this.prisma.savedSegment.delete({ where: { id } });
  }
}
```

**Step 3: Add routes to `crm-admin.controller.ts`**

```typescript
// ============================================================================
// Saved Segments
// ============================================================================

@Get('segments')
@ApiOperation({ summary: 'List saved segments with live counts' })
async listSegments() {
  return this.segmentService.listSegments();
}

@Post('segments')
@ApiOperation({ summary: 'Create a saved segment' })
async createSegment(@Body() dto: CreateSegmentDto) {
  return this.segmentService.createSegment(dto.name, dto.filters);
}

@Delete('segments/:id')
@ApiOperation({ summary: 'Delete a saved segment' })
async deleteSegment(@Param('id') id: string) {
  return this.segmentService.deleteSegment(id);
}
```

**Step 4: Register `SegmentService` in `crm.module.ts`**

**Step 5: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
git add src/modules/crm/
git commit -m "feat: add saved segments with live count computation"
```

---

### Task 5: API — Lead Scoring utility

**Files:**
- Create: `growsober-api/src/modules/crm/lead-scoring.util.ts`
- Modify: `growsober-api/src/modules/crm/crm.service.ts`

**Step 1: Create `lead-scoring.util.ts`**

```typescript
interface LeadForScoring {
  status: string;
  name: string | null;
  city: string | null;
  interests: string[];
  createdAt: Date;
  dripEnrollments?: Array<{ currentStep: number; status: string }>;
  smsConversations?: Array<{ messages: Array<{ direction: string }> }>;
}

export function computeLeadScore(lead: LeadForScoring): number {
  let score = 0;

  // Payment status (max 50)
  if (lead.status === 'MATCHED') score += 50;
  else if (lead.status === 'PAID') score += 40;

  // Drip engagement (max 30)
  if (lead.dripEnrollments?.length) {
    score += 15; // enrolled
    const maxStep = Math.max(...lead.dripEnrollments.map((e) => e.currentStep));
    score += Math.min(maxStep * 5, 15); // per step, capped at 15
  }

  // Profile completeness (max 15)
  if (lead.name) score += 5;
  if (lead.city) score += 5;
  if (lead.interests?.length > 0) score += 5;

  // Recency (max 10)
  const daysSinceCreated = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 3) score += 10;
  else if (daysSinceCreated <= 7) score += 5;

  // SMS responsiveness (max 10)
  const hasInbound = lead.smsConversations?.some((c) =>
    c.messages.some((m) => m.direction === 'IN'),
  );
  if (hasInbound) score += 10;

  return Math.min(score, 100);
}
```

**Step 2: Add scoring to `queryLeads` and `getLeadById` in `crm.service.ts`**

Import `computeLeadScore` and map over results:

In `queryLeads()`, after fetching data, add:
```typescript
const scoredData = data.map((lead) => ({
  ...lead,
  score: computeLeadScore(lead as any),
}));
```
Return `scoredData` instead of `data`.

In `getLeadById()`, after fetching:
```typescript
const lead = await this.prisma.phoneIntakeLead.findUniqueOrThrow({ ... });
return { ...lead, score: computeLeadScore(lead as any) };
```

**Step 3: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
git add src/modules/crm/
git commit -m "feat: add computed lead scoring utility"
```

---

### Task 6: API — Build, deploy, migrate

**Step 1: Build API**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
npm run build
```

**Step 2: Push to GitHub**

```bash
git push origin main
```

**Step 3: Deploy to Vercel**

```bash
npx vercel --prod --yes
```

**Step 4: Run migration on production**

```bash
npx prisma migrate deploy
```

**Step 5: Verify endpoints**

```bash
curl -s -H "x-api-key: $API_KEY" https://growsober-api.vercel.app/api/v1/crm/segments | jq .
curl -s -H "x-api-key: $API_KEY" https://growsober-api.vercel.app/api/v1/crm/scheduled | jq .
```

---

### Task 7: Admin Frontend — API client functions and types

**Files:**
- Modify: `growsober-intake-admin/lib/api.ts`

**Step 1: Add new types**

```typescript
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
```

**Step 2: Add API functions**

```typescript
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
```

**Step 3: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
git add lib/api.ts
git commit -m "feat: add API client functions for CRM expansion features"
```

---

### Task 8: Admin Frontend — Lead Detail Page

**Files:**
- Create: `growsober-intake-admin/app/crm/leads/[id]/page.tsx`
- Modify: `growsober-intake-admin/app/crm/page.tsx` (make rows clickable)
- Modify: `growsober-intake-admin/lib/constants.ts` (add score colors)

**Step 1: Add score color helper to `lib/constants.ts`**

```typescript
export function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500/20 text-green-300 border-green-500/30';
  if (score >= 40) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
}

export const ACTIVITY_ICONS: Record<string, string> = {
  NOTE: '📝',
  STATUS_CHANGE: '🔄',
  TAG_ADDED: '🏷️',
  TAG_REMOVED: '🏷️',
  ENROLLED: '📧',
  UNENROLLED: '❌',
  PAYMENT: '💳',
  SMS_SENT: '📤',
  SMS_RECEIVED: '📥',
};
```

**Step 2: Create Lead Detail page at `app/crm/leads/[id]/page.tsx`**

This is the largest single component. It should include these sections:
1. **Header** with back button, name, phone, editable status dropdown, source badge, score badge
2. **Quick info cards** row: city, sobriety status, interests, tags (with TagManager)
3. **Payment section**: paid/unpaid badge, Stripe link, send/retry payment button
4. **Two-column layout below**:
   - Left column (wider): Activity timeline + Notes input
   - Right column: SMS conversation with chat bubbles + compose box
5. **Drip enrollments** table at bottom

The page fetches data from `getCrmLead()`, `getLeadActivity()`, and `getLeadSms()` on mount.

Key UI patterns to follow (from existing pages):
- `min-h-screen bg-gray-950 text-white p-6`
- `max-w-7xl mx-auto space-y-6`
- Cards: `bg-gray-900 border-gray-800`
- Badges from `lib/constants.ts`
- Tables from shadcn `Table` components

**Step 3: Make CRM Leads table rows clickable**

In `app/crm/page.tsx`, add `useRouter` and wrap each `<TableRow>` with an `onClick` handler:

```typescript
onClick={() => router.push(`/crm/leads/${lead.id}`)}
className="border-gray-800 hover:bg-gray-800/50 cursor-pointer"
```

**Step 4: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
git add app/crm/leads/ app/crm/page.tsx lib/constants.ts
git commit -m "feat: add lead detail page with activity log, SMS, payment, enrollments"
```

---

### Task 9: Admin Frontend — Kanban Pipeline View

**Files:**
- Create: `growsober-intake-admin/components/crm/KanbanBoard.tsx`
- Modify: `growsober-intake-admin/app/crm/page.tsx` (add toggle)

**Step 1: Install @hello-pangea/dnd**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
npm install @hello-pangea/dnd
```

**Step 2: Create `components/crm/KanbanBoard.tsx`**

Props: `{ leads: CrmLead[], onStatusChange: (leadId: string, newStatus: string) => void }`

Columns: `['CALLED', 'INFO_COLLECTED', 'LINK_SENT', 'PAID', 'MATCHED', 'FAILED']`

Each column is a `Droppable` with lead cards as `Draggable` items. Cards show name, phone, top tag.

Use `DragDropContext` → `onDragEnd` to detect column change and call `onStatusChange`.

Styling: columns use `bg-gray-900 border-gray-800 rounded-lg`, cards use `bg-gray-800 border-gray-700 rounded p-3`, column headers show status name + count.

**Step 3: Add toggle to CRM Leads page**

Add a `viewMode` state: `'table' | 'pipeline'`. Add toggle buttons above the filter bar. When `pipeline` is selected, render `<KanbanBoard>` instead of the table. Pass leads data and a handler that calls `updateLead(id, { status })` then refreshes.

**Step 4: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
git add components/crm/KanbanBoard.tsx app/crm/page.tsx package.json package-lock.json
git commit -m "feat: add kanban pipeline view with drag-and-drop status changes"
```

---

### Task 10: Admin Frontend — Saved Segments UI

**Files:**
- Create: `growsober-intake-admin/components/crm/SegmentBar.tsx`
- Modify: `growsober-intake-admin/app/crm/page.tsx`

**Step 1: Create `components/crm/SegmentBar.tsx`**

Props: `{ segments: SavedSegment[], activeSegmentId: string | null, onSelect: (filters) => void, onSave: (name) => void, onDelete: (id) => void, showSave: boolean }`

Renders a horizontal row of pill buttons. Each shows segment name + count badge. Active segment is highlighted. "Save filters" button appears when `showSave` is true. Delete button (X) on hover per segment.

**Step 2: Integrate into CRM Leads page**

- Fetch segments on mount with `getSegments()`
- Render `<SegmentBar>` above filter bar
- On segment click, apply its filters to the filter state
- "Save filters" creates a new segment from current filter values (prompt for name)

**Step 3: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
git add components/crm/SegmentBar.tsx app/crm/page.tsx
git commit -m "feat: add saved segments bar with live counts"
```

---

### Task 11: Admin Frontend — Scheduled Messages Page

**Files:**
- Create: `growsober-intake-admin/app/crm/scheduled/page.tsx`
- Modify: `growsober-intake-admin/components/layout/Sidebar.tsx`

**Step 1: Create scheduled messages page**

Standard table page (follow pattern from `app/crm/sequences/page.tsx`):
- Table columns: Lead Name, Phone, Message (truncated to 60 chars), Scheduled For, Status badge, Actions
- Status filter dropdown (All / Pending / Sent / Cancelled / Failed)
- Actions: Cancel button (pending only), Send Now button (pending only)
- Status badges use colors from constants: PENDING=blue, SENT=green, CANCELLED=gray, FAILED=red

**Step 2: Add sidebar link**

In `components/layout/Sidebar.tsx`, add to the `nav` array:

```typescript
{ href: '/crm/scheduled', label: 'Scheduled', icon: Clock },
```

Import `Clock` from lucide-react.

**Step 3: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
git add app/crm/scheduled/ components/layout/Sidebar.tsx
git commit -m "feat: add scheduled messages page with sidebar nav"
```

---

### Task 12: Admin Frontend — Deploy and E2E test

**Step 1: Build locally to check for errors**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
npm run build
```

Fix any TypeScript or build errors.

**Step 2: Push and deploy**

```bash
git push origin main
npx vercel --prod --yes
```

**Step 3: E2E test with Playwright MCP**

Test each feature:
1. CRM Leads page — verify score badges visible, segment bar loads
2. Click a lead row — verify lead detail page loads with all sections
3. Add a note on lead detail — verify it appears in activity feed
4. View SMS conversation section
5. Toggle to Pipeline view — verify kanban columns with cards
6. Drag a card between columns — verify status updates
7. Navigate to Scheduled page — verify table loads
8. Save a segment from current filters — verify it appears in segment bar
9. Click a segment — verify filters apply

---

## Implementation Order

```
Task 1: Prisma schema (API)           — foundation
Task 2: Activity service (API)        — depends on Task 1
Task 3: SMS + Scheduled (API)         — depends on Task 1, 2
Task 4: Saved Segments (API)          — depends on Task 1
Task 5: Lead Scoring (API)            — standalone
Task 6: Build + Deploy API            — depends on Tasks 1-5
Task 7: API client (Admin)            — depends on Task 6
Task 8: Lead Detail Page (Admin)      — depends on Task 7
Task 9: Kanban Pipeline (Admin)       — depends on Task 7
Task 10: Saved Segments UI (Admin)    — depends on Task 7
Task 11: Scheduled Messages (Admin)   — depends on Task 7
Task 12: Deploy + E2E (Admin)         — depends on Tasks 8-11
```

Tasks 2-5 can be parallelized. Tasks 8-11 can be parallelized.
