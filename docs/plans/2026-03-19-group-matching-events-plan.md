# Group Matching, Event Automation & Configurable Workflows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two connected systems: (1) Cohort grouping — auto-group MATCHED leads into 3-5 person groups by city/interests, admin reviews & confirms, creates events, tracks RSVPs. (2) Automation engine — admin-configurable triggers that fire on lifecycle events (matched, invited, RSVP'd, X hours before event, etc.) with customizable message templates per trigger. All communications go through the automation engine, not hardcoded.

**Architecture:** Two new Prisma models: `Cohort`/`CohortMember` for grouping, `CrmAutomation` for trigger rules. `CohortService` handles grouping + lifecycle. `AutomationService` is an event bus — lifecycle actions call `automation.fire(trigger, context)` which finds matching active rules and sends templated messages. Admin gets `/crm/cohorts` for group management and `/crm/automations` for configuring triggers + templates.

**Tech Stack:** NestJS + Prisma (API), Next.js + React + shadcn/ui + Tailwind (admin). Existing TwilioService for SMS, NotificationsService for push. Existing Event/Booking models for events.

**Repos:**
- API: `/Users/rentamac/Projects/growsober/growsober-api`
- Admin: `/Users/rentamac/Projects/growsober/growsober-intake-admin`

---

## File Structure

### API (`growsober-api`)

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add Cohort, CohortMember, CrmAutomation, AutomationLog models |
| `src/modules/crm/dto/index.ts` | Add cohort + automation DTOs |
| `src/modules/crm/automation.service.ts` | **Core engine:** fire triggers, match rules, render templates, send messages, log deliveries |
| `src/modules/crm/cohort.service.ts` | Grouping algorithm, cohort CRUD, lifecycle — delegates messaging to AutomationService |
| `src/modules/crm/automation-scheduler.job.ts` | Cron: check time-based triggers (X hours before event) |
| `src/modules/crm/crm-admin.controller.ts` | Add cohort + automation endpoints |
| `src/modules/crm/crm.module.ts` | Register new providers |

### Admin (`growsober-intake-admin`)

| File | Responsibility |
|------|---------------|
| `lib/api.ts` | Add cohort + automation types and API functions |
| `app/crm/cohorts/page.tsx` | Cohort list (cards with status, members, actions) |
| `app/crm/cohorts/[id]/page.tsx` | Cohort detail (members, RSVP, attendance, lifecycle buttons) |
| `app/crm/automations/page.tsx` | Automation rules list (triggers, templates, toggle on/off) |
| `components/layout/Sidebar.tsx` | Add Cohorts + Automations nav links |

---

## Data Models

### CrmAutomation (configurable trigger → action rules)

```
CrmAutomation
├── id, name ("24h Event Reminder", "Welcome to Cohort", etc.)
├── trigger: enum — what fires this rule
├── triggerConfig: JSON — extra params per trigger (e.g. { hoursBeforeEvent: 24 })
├── channel: SMS | PUSH
├── messageTemplate: string — with {{placeholders}}
├── isActive: boolean
├── createdAt, updatedAt

Available Triggers:
  LEAD_MATCHED        — when convertLeadToUser completes
  COHORT_CREATED      — when lead is added to a cohort
  COHORT_INVITED      — when admin sends invitations
  RSVP_CONFIRMED      — when member confirms RSVP
  RSVP_DECLINED       — when member declines
  RSVP_CANCELLED      — when member cancels after confirming
  HOURS_BEFORE_EVENT  — X hours before event (set in triggerConfig)
  EVENT_COMPLETED     — when admin marks event complete
  ADDED_TO_WAITLIST   — when lead is waitlisted

Available Placeholders:
  {{name}}            — lead/member name
  {{phone}}           — phone number
  {{city}}            — lead city
  {{cohort_name}}     — cohort group name
  {{cohort_members}}  — comma-separated names of other members
  {{event_title}}     — event title
  {{event_date}}      — formatted event date
  {{event_location}}  — event location
  {{event_notes}}     — event notes/description
```

### AutomationLog (delivery tracking)

```
AutomationLog
├── id, automationId, leadId
├── trigger, channel
├── renderedMessage: string (after template substitution)
├── status: SENT | FAILED
├── error: string?
├── createdAt
```

### Cohort + CohortMember (same as before)

```
Cohort
├── status: DRAFT → CONFIRMED → INVITED → EVENT_CREATED → COMPLETED → CANCELLED
├── city, hubId, eventId, eventDate, eventLocation, eventNotes
├── members: CohortMember[]

CohortMember
├── leadId, rsvpStatus: PENDING | CONFIRMED | DECLINED | CANCELLED
├── reminderSent, attended
```

---

## How It Works (Flow)

```
1. Admin clicks "Generate Cohorts" → groups MATCHED leads → DRAFT cohorts created
   ↳ AutomationService.fire('COHORT_CREATED', { lead, cohort }) for each member

2. Admin reviews, edits members, sets event date/location → clicks "Confirm"
   ↳ Status → CONFIRMED

3. Admin clicks "Send Invitations"
   ↳ Status → INVITED
   ↳ AutomationService.fire('COHORT_INVITED', { lead, cohort }) for each member

4. Admin marks RSVP per member (from SMS replies or manual)
   ↳ AutomationService.fire('RSVP_CONFIRMED' | 'RSVP_DECLINED', { lead, cohort })

5. Admin clicks "Create Event" → Event + Bookings created
   ↳ Status → EVENT_CREATED

6. Cron checks hourly → finds cohorts with events in next X hours
   ↳ AutomationService.fire('HOURS_BEFORE_EVENT', { lead, cohort, event })

7. After event → admin marks attendance, clicks "Complete"
   ↳ AutomationService.fire('EVENT_COMPLETED', { lead, cohort, event })
```

**Key insight:** The cohort service never sends SMS directly. It calls `automationService.fire(trigger, context)`. If no active automation matches that trigger, nothing happens. Admin controls everything through the automations page.

---

### Task 1: Prisma Schema — Add all new models

**Files:**
- Modify: `growsober-api/prisma/schema.prisma`

- [ ] **Step 1: Add enums and models to schema.prisma**

Add after the `SavedSegment` model:

```prisma
// ============================================================================
// CRM Automation Models
// ============================================================================

enum AutomationTrigger {
  LEAD_MATCHED
  COHORT_CREATED
  COHORT_INVITED
  RSVP_CONFIRMED
  RSVP_DECLINED
  RSVP_CANCELLED
  HOURS_BEFORE_EVENT
  EVENT_COMPLETED
  ADDED_TO_WAITLIST
}

enum AutomationChannel {
  SMS
  PUSH
}

enum AutomationLogStatus {
  SENT
  FAILED
}

model CrmAutomation {
  id              String             @id @default(uuid())
  name            String
  trigger         AutomationTrigger
  triggerConfig   Json?              // e.g. { hoursBeforeEvent: 24 }
  channel         AutomationChannel  @default(SMS)
  messageTemplate String             // with {{placeholders}}
  isActive        Boolean            @default(true)
  logs            AutomationLog[]
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@index([trigger, isActive])
  @@map("crm_automations")
}

model AutomationLog {
  id              String              @id @default(uuid())
  automationId    String
  automation      CrmAutomation       @relation(fields: [automationId], references: [id], onDelete: Cascade)
  leadId          String?
  trigger         AutomationTrigger
  channel         AutomationChannel
  renderedMessage String
  status          AutomationLogStatus
  error           String?
  createdAt       DateTime            @default(now())

  @@index([automationId])
  @@index([leadId])
  @@index([createdAt])
  @@map("automation_logs")
}

// ============================================================================
// Cohort Matching Models
// ============================================================================

enum CohortStatus {
  DRAFT
  CONFIRMED
  INVITED
  EVENT_CREATED
  COMPLETED
  CANCELLED
}

enum RsvpStatus {
  PENDING
  CONFIRMED
  DECLINED
  CANCELLED
}

model Cohort {
  id             String       @id @default(uuid())
  name           String       // e.g. "London Crew #4"
  status         CohortStatus @default(DRAFT)
  city           String?
  hubId          String?
  hub            Hub?         @relation(fields: [hubId], references: [id])
  eventId        String?      @unique
  event          Event?       @relation(fields: [eventId], references: [id])
  eventDate      DateTime?
  eventLocation  String?
  eventNotes     String?
  invitedAt      DateTime?
  reminderSentAt DateTime?
  members        CohortMember[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([status])
  @@index([city])
  @@map("cohorts")
}

model CohortMember {
  id           String     @id @default(uuid())
  cohortId     String
  cohort       Cohort     @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  leadId       String
  lead         PhoneIntakeLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  rsvpStatus   RsvpStatus @default(PENDING)
  rsvpAt       DateTime?
  cancelledAt  DateTime?
  cancelReason String?
  reminderSent Boolean    @default(false)
  attended     Boolean    @default(false)
  createdAt    DateTime   @default(now())

  @@unique([cohortId, leadId])
  @@index([leadId])
  @@index([cohortId, rsvpStatus])
  @@map("cohort_members")
}
```

- [ ] **Step 2: Add relations to existing models**

Add to `PhoneIntakeLead` model:
```prisma
  cohortMembers     CohortMember[]
```

Add to `Hub` model:
```prisma
  cohorts           Cohort[]
```

Add to `Event` model:
```prisma
  cohort            Cohort?
```

- [ ] **Step 3: Generate Prisma client and push to both databases**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
npx prisma generate
npx prisma db push
# Then push to prod:
vercel env pull .env.vercel-prod --environment production
export $(grep DATABASE_URL .env.vercel-prod | xargs) && npx prisma db push
rm .env.vercel-prod
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add CrmAutomation, AutomationLog, Cohort, CohortMember models"
```

---

### Task 2: API — Automation DTOs + Cohort DTOs

**Files:**
- Modify: `growsober-api/src/modules/crm/dto/index.ts`

- [ ] **Step 1: Add all DTOs to `dto/index.ts`**

```typescript
// ============================================================================
// Automation DTOs
// ============================================================================

export class CreateAutomationDto {
  @ApiProperty({ example: '24h Event Reminder' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ['LEAD_MATCHED', 'COHORT_CREATED', 'COHORT_INVITED', 'RSVP_CONFIRMED', 'RSVP_DECLINED', 'RSVP_CANCELLED', 'HOURS_BEFORE_EVENT', 'EVENT_COMPLETED', 'ADDED_TO_WAITLIST'] })
  @IsString()
  trigger: string;

  @ApiPropertyOptional({ example: { hoursBeforeEvent: 24 } })
  @IsOptional()
  triggerConfig?: Record<string, unknown>;

  @ApiProperty({ enum: ['SMS', 'PUSH'] })
  @IsString()
  channel: string;

  @ApiProperty({ example: 'Hey {{name}}, your meetup "{{cohort_name}}" is tomorrow at {{event_location}}!' })
  @IsString()
  messageTemplate: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  triggerConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================================================
// Cohort DTOs
// ============================================================================

export class GenerateCohortsDto {
  @ApiPropertyOptional({ description: 'Only group leads from this city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  minSize?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  maxSize?: number;
}

export class ConfirmCohortDto {
  @ApiProperty({ example: '2026-04-01T18:00:00Z' })
  @IsString()
  eventDate: string;

  @ApiPropertyOptional({ example: 'The Sober Cafe, 12 High St, London' })
  @IsOptional()
  @IsString()
  eventLocation?: string;

  @ApiPropertyOptional({ example: 'Casual coffee meetup' })
  @IsOptional()
  @IsString()
  eventNotes?: string;
}

export class UpdateCohortMemberDto {
  @ApiProperty({ enum: ['CONFIRMED', 'DECLINED', 'CANCELLED'] })
  @IsString()
  rsvpStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class AddCohortMemberDto {
  @ApiProperty()
  @IsString()
  leadId: string;
}

export class QueryCohortDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED', 'INVITED', 'EVENT_CREATED', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

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

- [ ] **Step 2: Commit**

```bash
git add src/modules/crm/dto/index.ts
git commit -m "feat: add automation and cohort DTOs"
```

---

### Task 3: API — AutomationService (the event bus / engine)

**Files:**
- Create: `growsober-api/src/modules/crm/automation.service.ts`

This is the **core engine**. Every lifecycle action calls `fire(trigger, context)`. The service finds matching active automations, renders the template with context data, and sends via the configured channel.

- [ ] **Step 1: Create `automation.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { TwilioService } from '@modules/auth/twilio.service';
import { AutomationTrigger, AutomationChannel, Prisma } from '@prisma/client';

export interface AutomationContext {
  lead?: { id: string; name: string | null; phone: string; city: string | null };
  cohort?: { name: string; eventDate: Date | null; eventLocation: string | null; eventNotes: string | null; members: Array<{ lead: { name: string | null } }> };
  event?: { title: string; startDate: Date; locationName: string | null };
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * Fire a trigger — find all active automations matching this trigger and execute them.
   */
  async fire(trigger: string, context: AutomationContext) {
    const automations = await this.prisma.crmAutomation.findMany({
      where: {
        trigger: trigger as AutomationTrigger,
        isActive: true,
      },
    });

    if (automations.length === 0) return [];

    const results = [];

    for (const automation of automations) {
      try {
        const rendered = this.renderTemplate(automation.messageTemplate, context);

        if (automation.channel === 'SMS' && context.lead?.phone) {
          await this.twilioService.sendSms(context.lead.phone, rendered);
        }
        // PUSH channel: would use NotificationsService — add when needed

        const log = await this.prisma.automationLog.create({
          data: {
            automationId: automation.id,
            leadId: context.lead?.id,
            trigger: trigger as AutomationTrigger,
            channel: automation.channel,
            renderedMessage: rendered,
            status: 'SENT',
          },
        });

        results.push(log);
        this.logger.log(`Automation "${automation.name}" fired for ${context.lead?.phone || 'unknown'}`);
      } catch (err: any) {
        await this.prisma.automationLog.create({
          data: {
            automationId: automation.id,
            leadId: context.lead?.id,
            trigger: trigger as AutomationTrigger,
            channel: automation.channel,
            renderedMessage: this.renderTemplate(automation.messageTemplate, context),
            status: 'FAILED',
            error: err.message,
          },
        });
        this.logger.error(`Automation "${automation.name}" failed: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Render a message template with context placeholders.
   */
  renderTemplate(template: string, ctx: AutomationContext): string {
    const lead = ctx.lead;
    const cohort = ctx.cohort;
    const event = ctx.event;

    const otherMembers = cohort?.members
      ?.filter((m) => m.lead.name !== lead?.name)
      ?.map((m) => m.lead.name || 'someone')
      ?.join(', ') || '';

    const formatDate = (d: Date | null | undefined) => {
      if (!d) return '';
      return new Date(d).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    return template
      .replace(/\{\{name\}\}/g, lead?.name || 'there')
      .replace(/\{\{phone\}\}/g, lead?.phone || '')
      .replace(/\{\{city\}\}/g, lead?.city || 'your city')
      .replace(/\{\{cohort_name\}\}/g, cohort?.name || '')
      .replace(/\{\{cohort_members\}\}/g, otherMembers)
      .replace(/\{\{event_title\}\}/g, event?.title || cohort?.name || '')
      .replace(/\{\{event_date\}\}/g, formatDate(event?.startDate || cohort?.eventDate))
      .replace(/\{\{event_location\}\}/g, event?.locationName || cohort?.eventLocation || '')
      .replace(/\{\{event_notes\}\}/g, cohort?.eventNotes || '');
  }

  // ============================================================================
  // CRUD for admin
  // ============================================================================

  async listAutomations() {
    return this.prisma.crmAutomation.findMany({
      orderBy: [{ trigger: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { logs: true } },
      },
    });
  }

  async getAutomation(id: string) {
    return this.prisma.crmAutomation.findUniqueOrThrow({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { logs: true } },
      },
    });
  }

  async createAutomation(dto: {
    name: string;
    trigger: string;
    triggerConfig?: Record<string, unknown>;
    channel: string;
    messageTemplate: string;
    isActive?: boolean;
  }) {
    return this.prisma.crmAutomation.create({
      data: {
        name: dto.name,
        trigger: dto.trigger as AutomationTrigger,
        triggerConfig: dto.triggerConfig as Prisma.InputJsonValue,
        channel: (dto.channel || 'SMS') as AutomationChannel,
        messageTemplate: dto.messageTemplate,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateAutomation(id: string, dto: {
    name?: string;
    triggerConfig?: Record<string, unknown>;
    channel?: string;
    messageTemplate?: string;
    isActive?: boolean;
  }) {
    return this.prisma.crmAutomation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.triggerConfig !== undefined && { triggerConfig: dto.triggerConfig as Prisma.InputJsonValue }),
        ...(dto.channel !== undefined && { channel: dto.channel as AutomationChannel }),
        ...(dto.messageTemplate !== undefined && { messageTemplate: dto.messageTemplate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteAutomation(id: string) {
    await this.prisma.crmAutomation.delete({ where: { id } });
    return { success: true };
  }

  async getAutomationLogs(automationId?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = automationId ? { automationId } : {};

    const [data, total] = await Promise.all([
      this.prisma.automationLog.findMany({
        where,
        include: { automation: { select: { name: true, trigger: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.automationLog.count({ where }),
    ]);

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  /**
   * Find automations with HOURS_BEFORE_EVENT trigger that need to fire.
   * Called by the scheduler cron job.
   */
  async getTimeBasedAutomations() {
    return this.prisma.crmAutomation.findMany({
      where: {
        trigger: 'HOURS_BEFORE_EVENT',
        isActive: true,
      },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/crm/automation.service.ts
git commit -m "feat: add automation engine with fire/render/CRUD and delivery logging"
```

---

### Task 4: API — CohortService (uses AutomationService for all messaging)

**Files:**
- Create: `growsober-api/src/modules/crm/cohort.service.ts`

- [ ] **Step 1: Create `cohort.service.ts`**

This service handles grouping + lifecycle. It **never sends SMS directly** — it always calls `automationService.fire(trigger, context)`. If admin hasn't configured an automation for that trigger, nothing happens.

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { AutomationService, AutomationContext } from './automation.service';
import { RsvpStatus } from '@prisma/client';

interface LeadForGrouping {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  interests: string[];
  hubId: string | null;
}

@Injectable()
export class CohortService {
  private readonly logger = new Logger(CohortService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly automationService: AutomationService,
  ) {}

  // ============================================================================
  // Grouping Algorithm
  // ============================================================================

  async generateCohorts(city?: string, minSize = 3, maxSize = 5) {
    // Find MATCHED leads not in any active cohort
    const activeCohortLeadIds = await this.prisma.cohortMember.findMany({
      where: {
        cohort: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      },
      select: { leadId: true },
    });
    const excludeIds = new Set(activeCohortLeadIds.map((m) => m.leadId));

    const where: any = { status: 'MATCHED', city: { not: null } };
    if (city) where.city = { contains: city, mode: 'insensitive' };

    const leads = await this.prisma.phoneIntakeLead.findMany({
      where,
      select: { id: true, name: true, phone: true, city: true, interests: true, hubId: true },
      orderBy: { createdAt: 'asc' },
    });

    const available = leads.filter((l) => !excludeIds.has(l.id));

    // Group by city
    const byCity = new Map<string, LeadForGrouping[]>();
    for (const lead of available) {
      const key = (lead.city || 'Unknown').toLowerCase().trim();
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key)!.push(lead);
    }

    const groups: Array<{ name: string; city: string; hubId: string | null; memberIds: string[] }> = [];

    for (const [cityKey, cityLeads] of byCity) {
      if (cityLeads.length < minSize) continue;

      const sorted = this.clusterByInterests(cityLeads);
      const cityName = cityLeads[0].city || cityKey;
      const existingCount = await this.prisma.cohort.count({
        where: { city: { contains: cityName, mode: 'insensitive' } },
      });

      let groupNum = 1;
      for (let i = 0; i < sorted.length; i += maxSize) {
        const chunk = sorted.slice(i, i + maxSize);
        if (chunk.length < minSize) {
          if (groups.length > 0 && groups[groups.length - 1].city.toLowerCase() === cityKey) {
            groups[groups.length - 1].memberIds.push(...chunk.map((l) => l.id));
            continue;
          }
          continue;
        }
        groups.push({
          name: `${cityName} Crew #${existingCount + groupNum}`,
          city: cityName,
          hubId: chunk[0].hubId,
          memberIds: chunk.map((l) => l.id),
        });
        groupNum++;
      }
    }

    // Create cohorts and fire COHORT_CREATED for each member
    const created = [];
    for (const group of groups) {
      const cohort = await this.prisma.cohort.create({
        data: {
          name: group.name,
          city: group.city,
          hubId: group.hubId,
          status: 'DRAFT',
          members: { create: group.memberIds.map((leadId) => ({ leadId })) },
        },
        include: {
          members: { include: { lead: { select: { id: true, name: true, phone: true, city: true } } } },
        },
      });

      // Fire automation for each member
      for (const member of cohort.members) {
        await this.automationService.fire('COHORT_CREATED', {
          lead: member.lead,
          cohort: { ...cohort, members: cohort.members },
        } as AutomationContext);
      }

      created.push(cohort);
    }

    this.logger.log(`Generated ${created.length} cohorts from ${available.length} available leads`);
    return created;
  }

  private clusterByInterests(leads: LeadForGrouping[]): LeadForGrouping[] {
    if (leads.length <= 1) return leads;
    const remaining = [...leads];
    const sorted: LeadForGrouping[] = [remaining.shift()!];

    while (remaining.length > 0) {
      const last = sorted[sorted.length - 1];
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < remaining.length; i++) {
        const shared = last.interests.filter((x) => remaining[i].interests.includes(x)).length;
        if (shared > bestScore) { bestScore = shared; bestIdx = i; }
      }
      sorted.push(remaining.splice(bestIdx, 1)[0]);
    }
    return sorted;
  }

  // ============================================================================
  // CRUD
  // ============================================================================

  async listCohorts(status?: string, city?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (city) where.city = { contains: city, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.cohort.findMany({
        where,
        include: {
          members: { include: { lead: { select: { id: true, name: true, phone: true, interests: true } } } },
          hub: { select: { id: true, name: true } },
          event: { select: { id: true, title: true, startDate: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cohort.count({ where }),
    ]);
    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getCohort(id: string) {
    return this.prisma.cohort.findUniqueOrThrow({
      where: { id },
      include: {
        members: {
          include: {
            lead: { select: { id: true, name: true, phone: true, city: true, interests: true, sobrietyStatus: true } },
          },
        },
        hub: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, startDate: true, status: true, locationName: true } },
      },
    });
  }

  async addMember(cohortId: string, leadId: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } });
    if (cohort.status !== 'DRAFT') throw new BadRequestException('Can only add members to DRAFT cohorts');
    return this.prisma.cohortMember.create({
      data: { cohortId, leadId },
      include: { lead: { select: { id: true, name: true, phone: true } } },
    });
  }

  async removeMember(cohortId: string, memberId: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } });
    if (cohort.status !== 'DRAFT') throw new BadRequestException('Can only remove members from DRAFT cohorts');
    return this.prisma.cohortMember.delete({ where: { id: memberId } });
  }

  async deleteCohort(id: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id } });
    if (!['DRAFT', 'CANCELLED'].includes(cohort.status)) throw new BadRequestException('Can only delete DRAFT or CANCELLED cohorts');
    await this.prisma.cohort.delete({ where: { id } });
    return { success: true };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async confirmCohort(id: string, eventDate: string, eventLocation?: string, eventNotes?: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id }, include: { members: true } });
    if (cohort.status !== 'DRAFT') throw new BadRequestException('Must be DRAFT to confirm');
    if (cohort.members.length < 2) throw new BadRequestException('Need at least 2 members');

    return this.prisma.cohort.update({
      where: { id },
      data: { status: 'CONFIRMED', eventDate: new Date(eventDate), eventLocation, eventNotes },
      include: { members: { include: { lead: { select: { id: true, name: true, phone: true } } } } },
    });
  }

  async sendInvitations(id: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id },
      include: { members: { include: { lead: { select: { id: true, name: true, phone: true, city: true } } } } },
    });
    if (cohort.status !== 'CONFIRMED') throw new BadRequestException('Must be CONFIRMED to invite');
    if (!cohort.eventDate) throw new BadRequestException('Event date required');

    for (const member of cohort.members) {
      await this.automationService.fire('COHORT_INVITED', {
        lead: member.lead,
        cohort: { ...cohort, members: cohort.members },
      } as AutomationContext);
    }

    return this.prisma.cohort.update({
      where: { id },
      data: { status: 'INVITED', invitedAt: new Date() },
      include: { members: { include: { lead: { select: { id: true, name: true, phone: true } } } } },
    });
  }

  async updateMemberRsvp(memberId: string, rsvpStatus: string, cancelReason?: string) {
    const member = await this.prisma.cohortMember.update({
      where: { id: memberId },
      data: {
        rsvpStatus: rsvpStatus as RsvpStatus,
        rsvpAt: new Date(),
        ...(rsvpStatus === 'CANCELLED' || rsvpStatus === 'DECLINED' ? { cancelledAt: new Date(), cancelReason } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, city: true } },
        cohort: { include: { members: { include: { lead: { select: { id: true, name: true } } } } } },
      },
    });

    // Fire appropriate automation
    const triggerMap: Record<string, string> = { CONFIRMED: 'RSVP_CONFIRMED', DECLINED: 'RSVP_DECLINED', CANCELLED: 'RSVP_CANCELLED' };
    const trigger = triggerMap[rsvpStatus];
    if (trigger) {
      await this.automationService.fire(trigger, {
        lead: member.lead,
        cohort: { ...member.cohort, members: member.cohort.members },
      } as AutomationContext);
    }

    return member;
  }

  async createEventForCohort(id: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id },
      include: {
        members: { where: { rsvpStatus: 'CONFIRMED' }, include: { lead: { select: { id: true, name: true, phone: true, userId: true } } } },
      },
    });
    if (!['INVITED', 'CONFIRMED'].includes(cohort.status)) throw new BadRequestException('Must be INVITED or CONFIRMED');
    if (!cohort.eventDate) throw new BadRequestException('Event date required');
    if (cohort.eventId) throw new BadRequestException('Event already created');

    const slug = `cohort-${cohort.id.slice(0, 8)}-${Date.now()}`;
    const event = await this.prisma.event.create({
      data: {
        appId: 'growsober',
        title: cohort.name,
        slug,
        description: cohort.eventNotes || `Small group meetup for ${cohort.name}`,
        startDate: cohort.eventDate,
        endDate: new Date(cohort.eventDate.getTime() + 2 * 60 * 60_000),
        locationName: cohort.eventLocation,
        totalSpots: cohort.members.length + 2,
        availableSpots: 2,
        isFree: true,
        hubId: cohort.hubId,
        status: 'PUBLISHED',
        visibility: 'INVITE_ONLY',
        bookingCount: cohort.members.length,
      },
    });

    for (const member of cohort.members) {
      if (member.lead.userId) {
        await this.prisma.booking.create({
          data: {
            eventId: event.id,
            userId: member.lead.userId,
            status: 'CONFIRMED',
            qrCode: `cohort-${member.id}-${Date.now()}`,
            ticketCount: 1,
            totalPrice: 0,
            paymentStatus: 'COMPLETED',
          },
        });
      }
    }

    return this.prisma.cohort.update({
      where: { id },
      data: { status: 'EVENT_CREATED', eventId: event.id },
      include: {
        members: { include: { lead: { select: { id: true, name: true, phone: true } } } },
        event: { select: { id: true, title: true, startDate: true, status: true } },
      },
    });
  }

  async sendReminders(id: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id },
      include: {
        members: {
          where: { rsvpStatus: 'CONFIRMED', reminderSent: false },
          include: { lead: { select: { id: true, name: true, phone: true, city: true } } },
        },
      },
    });

    for (const member of cohort.members) {
      await this.automationService.fire('HOURS_BEFORE_EVENT', {
        lead: member.lead,
        cohort: { ...cohort, members: cohort.members },
      } as AutomationContext);

      await this.prisma.cohortMember.update({
        where: { id: member.id },
        data: { reminderSent: true },
      });
    }

    return this.prisma.cohort.update({
      where: { id },
      data: { reminderSentAt: new Date() },
    });
  }

  async markAttendance(memberId: string, attended: boolean) {
    return this.prisma.cohortMember.update({
      where: { id: memberId },
      data: { attended },
      include: { lead: { select: { id: true, name: true, phone: true } } },
    });
  }

  async completeCohort(id: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id },
      include: {
        members: {
          where: { attended: true },
          include: { lead: { select: { id: true, name: true, phone: true, city: true } } },
        },
      },
    });
    if (cohort.status !== 'EVENT_CREATED') throw new BadRequestException('Must be EVENT_CREATED to complete');

    // Fire EVENT_COMPLETED for attendees
    for (const member of cohort.members) {
      await this.automationService.fire('EVENT_COMPLETED', {
        lead: member.lead,
        cohort: { ...cohort, members: cohort.members },
      } as AutomationContext);
    }

    return this.prisma.cohort.update({ where: { id }, data: { status: 'COMPLETED' } });
  }

  async cancelCohort(id: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id } });
    if (cohort.status === 'COMPLETED') throw new BadRequestException('Cannot cancel completed cohort');
    return this.prisma.cohort.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/crm/cohort.service.ts
git commit -m "feat: add cohort service with grouping algorithm, lifecycle actions, automation integration"
```

---

### Task 5: API — Automation Scheduler Cron Job

**Files:**
- Create: `growsober-api/src/modules/crm/automation-scheduler.job.ts`

- [ ] **Step 1: Create cron job for time-based triggers**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@prisma/prisma.service';
import { CohortService } from './cohort.service';
import { AutomationService } from './automation.service';

@Injectable()
export class AutomationSchedulerJob {
  private readonly logger = new Logger(AutomationSchedulerJob.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortService: CohortService,
    private readonly automationService: AutomationService,
  ) {}

  @Cron('0 * * * *') // Every hour
  async processTimeBasedTriggers() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const automations = await this.automationService.getTimeBasedAutomations();

      for (const automation of automations) {
        const config = (automation.triggerConfig as Record<string, number>) || {};
        const hours = config.hoursBeforeEvent || 24;

        const now = new Date();
        const windowStart = new Date(now.getTime() + hours * 60 * 60_000);
        const windowEnd = new Date(now.getTime() + (hours + 1) * 60 * 60_000);

        // Find cohorts with events in the reminder window that haven't been reminded
        const cohorts = await this.prisma.cohort.findMany({
          where: {
            status: { in: ['INVITED', 'EVENT_CREATED'] },
            eventDate: { gte: windowStart, lte: windowEnd },
            reminderSentAt: null,
          },
        });

        for (const cohort of cohorts) {
          try {
            await this.cohortService.sendReminders(cohort.id);
            this.logger.log(`Auto-sent ${hours}h reminder for cohort "${cohort.name}"`);
          } catch (err: any) {
            this.logger.error(`Auto-reminder failed for cohort ${cohort.id}: ${err.message}`);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/crm/automation-scheduler.job.ts
git commit -m "feat: add cron job for time-based automation triggers"
```

---

### Task 6: API — Controller endpoints + module registration

**Files:**
- Modify: `growsober-api/src/modules/crm/crm-admin.controller.ts`
- Modify: `growsober-api/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Add automation + cohort endpoints to controller**

Import `AutomationService`, `CohortService`, and new DTOs. Add both to constructor. Add these endpoint sections:

```typescript
// ============================================================================
// Automations
// ============================================================================

@Get('automations')
async listAutomations() { return this.automationService.listAutomations(); }

@Post('automations')
async createAutomation(@Body() dto: CreateAutomationDto) { return this.automationService.createAutomation(dto); }

@Get('automations/:id')
async getAutomation(@Param('id') id: string) { return this.automationService.getAutomation(id); }

@Patch('automations/:id')
async updateAutomation(@Param('id') id: string, @Body() dto: UpdateAutomationDto) { return this.automationService.updateAutomation(id, dto); }

@Delete('automations/:id')
async deleteAutomation(@Param('id') id: string) { return this.automationService.deleteAutomation(id); }

@Get('automation-logs')
async getAutomationLogs(@Query('automationId') automationId?: string, @Query('page') page?: number) {
  return this.automationService.getAutomationLogs(automationId, page);
}

// ============================================================================
// Cohorts
// ============================================================================

@Post('cohorts/generate')
async generateCohorts(@Body() dto: GenerateCohortsDto) { return this.cohortService.generateCohorts(dto.city, dto.minSize, dto.maxSize); }

@Get('cohorts')
async listCohorts(@Query() dto: QueryCohortDto) { return this.cohortService.listCohorts(dto.status, dto.city, dto.page, dto.limit); }

@Get('cohorts/:id')
async getCohort(@Param('id') id: string) { return this.cohortService.getCohort(id); }

@Post('cohorts/:id/confirm')
async confirmCohort(@Param('id') id: string, @Body() dto: ConfirmCohortDto) { return this.cohortService.confirmCohort(id, dto.eventDate, dto.eventLocation, dto.eventNotes); }

@Post('cohorts/:id/invite')
async sendInvitations(@Param('id') id: string) { return this.cohortService.sendInvitations(id); }

@Post('cohorts/:id/create-event')
async createCohortEvent(@Param('id') id: string) { return this.cohortService.createEventForCohort(id); }

@Post('cohorts/:id/send-reminders')
async sendReminders(@Param('id') id: string) { return this.cohortService.sendReminders(id); }

@Post('cohorts/:id/complete')
async completeCohort(@Param('id') id: string) { return this.cohortService.completeCohort(id); }

@Post('cohorts/:id/cancel')
async cancelCohort(@Param('id') id: string) { return this.cohortService.cancelCohort(id); }

@Delete('cohorts/:id')
async deleteCohort(@Param('id') id: string) { return this.cohortService.deleteCohort(id); }

@Post('cohorts/:id/members')
async addCohortMember(@Param('id') id: string, @Body() dto: AddCohortMemberDto) { return this.cohortService.addMember(id, dto.leadId); }

@Delete('cohorts/:cohortId/members/:memberId')
async removeCohortMember(@Param('cohortId') cohortId: string, @Param('memberId') memberId: string) { return this.cohortService.removeMember(cohortId, memberId); }

@Patch('cohort-members/:id/rsvp')
async updateMemberRsvp(@Param('id') id: string, @Body() dto: UpdateCohortMemberDto) { return this.cohortService.updateMemberRsvp(id, dto.rsvpStatus, dto.cancelReason); }

@Patch('cohort-members/:id/attendance')
async markAttendance(@Param('id') id: string, @Body() body: { attended: boolean }) { return this.cohortService.markAttendance(id, body.attended); }
```

- [ ] **Step 2: Register in `crm.module.ts`**

Add `AutomationService`, `CohortService`, `AutomationSchedulerJob` to providers and exports (services only).

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/crm/crm-admin.controller.ts src/modules/crm/crm.module.ts
git commit -m "feat: add automation and cohort endpoints, register in module"
```

---

### Task 7: API — Build, push schema, deploy, seed default automations

- [ ] **Step 1: Build + push schema + deploy**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
npm run build
git push origin main
vercel env pull .env.vercel-prod --environment production
export $(grep DATABASE_URL .env.vercel-prod | xargs) && npx prisma db push
rm .env.vercel-prod
npx vercel --prod --yes
```

- [ ] **Step 2: Seed default automation rules**

```bash
API_KEY="0bd4cb1420cc3a2064efbdf49aab823148efe74e37faa4f42aaa25b21f9f5d54"

# Cohort invitation
curl -X POST https://growsober-api.vercel.app/api/v1/crm/automations \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Cohort Invitation","trigger":"COHORT_INVITED","channel":"SMS","messageTemplate":"Hey {{name}}! GrowSober here. We have matched you with a small group: {{cohort_members}}. When: {{event_date}}. Where: {{event_location}}. {{event_notes}}\n\nReply YES to confirm or NO to decline."}'

# RSVP confirmation
curl -X POST https://growsober-api.vercel.app/api/v1/crm/automations \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"RSVP Confirmed","trigger":"RSVP_CONFIRMED","channel":"SMS","messageTemplate":"Awesome {{name}}! You are confirmed for {{cohort_name}} on {{event_date}}. We will send you a reminder before the meetup. See you there!"}'

# 24h reminder
curl -X POST https://growsober-api.vercel.app/api/v1/crm/automations \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"24h Event Reminder","trigger":"HOURS_BEFORE_EVENT","triggerConfig":{"hoursBeforeEvent":24},"channel":"SMS","messageTemplate":"Reminder: Your GrowSober meetup \"{{cohort_name}}\" is tomorrow ({{event_date}}) at {{event_location}}. Looking forward to seeing you!"}'

# Post-event thank you
curl -X POST https://growsober-api.vercel.app/api/v1/crm/automations \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Post-Event Thank You","trigger":"EVENT_COMPLETED","channel":"SMS","messageTemplate":"Hey {{name}}! Thanks for coming to {{cohort_name}}. Hope you had a great time. We will be in touch about the next one!"}'

# RSVP declined
curl -X POST https://growsober-api.vercel.app/api/v1/crm/automations \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"RSVP Declined","trigger":"RSVP_DECLINED","channel":"SMS","messageTemplate":"No worries {{name}}, we understand! We will match you with the next group in {{city}}. Stay tuned.","isActive":true}'
```

- [ ] **Step 3: Verify**

```bash
curl -s -H "x-api-key: $API_KEY" https://growsober-api.vercel.app/api/v1/crm/automations | python3 -m json.tool
curl -s -H "x-api-key: $API_KEY" https://growsober-api.vercel.app/api/v1/crm/cohorts | python3 -m json.tool
```

---

### Task 8: Admin Frontend — API client types + functions

**Files:**
- Modify: `growsober-intake-admin/lib/api.ts`

- [ ] **Step 1: Add all types and functions for automations + cohorts**

Add types: `CrmAutomation`, `AutomationLog`, `Cohort`, `CohortMember`

Add functions:
- Automations: `getAutomations`, `createAutomation`, `updateAutomation`, `deleteAutomation`, `getAutomationLogs`
- Cohorts: `generateCohorts`, `getCohorts`, `getCohort`, `confirmCohort`, `sendCohortInvitations`, `createCohortEvent`, `sendCohortReminders`, `completeCohort`, `cancelCohort`, `deleteCohort`, `addCohortMember`, `removeCohortMember`, `updateMemberRsvp`, `markMemberAttendance`

- [ ] **Step 2: Commit**

```bash
cd /Users/rentamac/Projects/growsober/growsober-intake-admin
git add lib/api.ts
git commit -m "feat: add automation and cohort types and API functions"
```

---

### Task 9: Admin Frontend — Automations Page

**Files:**
- Create: `growsober-intake-admin/app/crm/automations/page.tsx`
- Modify: `growsober-intake-admin/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add sidebar link**

Add `{ href: '/crm/automations', label: 'Automations', icon: Zap }` (import `Zap` from lucide-react — already imported for Drip Sequences, may need to add another icon like `Workflow` or `Settings`).

- [ ] **Step 2: Create automations page**

`app/crm/automations/page.tsx` — client component with:

**Card per automation** (not table — each automation needs more visual space):
- Title, trigger badge (color-coded by type), channel badge (SMS/PUSH)
- Active/inactive toggle switch
- Message template preview (with placeholder styling — e.g. `{{name}}` shown in highlighted text)
- Edit button → inline edit mode (textarea for template, save/cancel buttons)
- Trigger config display (e.g. "24 hours before event")
- Log count badge ("sent 12 times")
- Delete button (with confirm)

**"Add Automation" button** at top:
- Modal/form: name, trigger dropdown, channel, template textarea, triggerConfig (shown only for HOURS_BEFORE_EVENT)
- Placeholder reference helper: show available placeholders below textarea

**Available placeholders sidebar/help text:**
```
{{name}} — Member name
{{city}} — Member city
{{cohort_name}} — Group name
{{cohort_members}} — Other members' names
{{event_date}} — Event date/time
{{event_location}} — Event location
{{event_notes}} — Event description
```

- [ ] **Step 3: Commit**

```bash
git add app/crm/automations/ components/layout/Sidebar.tsx
git commit -m "feat: add automations page with template editor and toggle"
```

---

### Task 10: Admin Frontend — Cohorts List Page

**Files:**
- Create: `growsober-intake-admin/app/crm/cohorts/page.tsx`
- Modify: `growsober-intake-admin/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add sidebar link**

Add `{ href: '/crm/cohorts', label: 'Cohorts', icon: UsersRound }` (import from lucide-react).

- [ ] **Step 2: Create cohorts list page**

Cards layout with: cohort name, city, status badge, member count, event date, member names as pills with RSVP status colors. Action buttons based on status. "Generate Cohorts" button with optional city filter.

- [ ] **Step 3: Commit**

---

### Task 11: Admin Frontend — Cohort Detail Page

**Files:**
- Create: `growsober-intake-admin/app/crm/cohorts/[id]/page.tsx`

- [ ] **Step 1: Create cohort detail page**

Header with back button, name, status, lifecycle action buttons. Event details section. Members table with RSVP management and attendance tracking. Confirm modal with date/location form.

- [ ] **Step 2: Commit**

---

### Task 12: Admin Frontend — Build, deploy, E2E test

- [ ] **Step 1: Build + deploy**
- [ ] **Step 2: Add E2E tests for cohorts and automations pages**
- [ ] **Step 3: Run tests and commit**

---

## Implementation Order

```
Task 1:  Prisma schema (all 4 new models)           — foundation
Task 2:  DTOs (automation + cohort)                  — depends on 1
Task 3:  AutomationService (engine)                  — depends on 1
Task 4:  CohortService (uses AutomationService)      — depends on 3
Task 5:  Automation scheduler cron                   — depends on 3, 4
Task 6:  Controller + module                         — depends on 3, 4, 5
Task 7:  Build, deploy API, seed defaults            — depends on 1-6
Task 8:  API client (Admin)                          — depends on 7
Task 9:  Automations page (Admin)                    — depends on 8
Task 10: Cohorts list page (Admin)                   — depends on 8
Task 11: Cohort detail page (Admin)                  — depends on 8
Task 12: Deploy + E2E (Admin)                        — depends on 9-11
```

Tasks 3-5 can be parallelized. Tasks 9-11 can be parallelized.
