# Smart Matching, SMS RSVP Parsing & City Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the greedy interest-clustering algorithm with OpenAI-powered smart matching that considers interests, sobriety status, and personality fit. Add automated SMS reply parsing so members can RSVP by texting YES/NO. Add re-matching for declined members. Add per-city settings for minimum confirmed threshold before event creation.

**Architecture:** New `CitySettings` Prisma model for per-city config (min confirmed, default event location). New `smart-matching.service.ts` uses OpenAI to score lead pairs and form optimal groups. SMS webhook extended to detect RSVP replies by matching inbound phone numbers to pending cohort members. Re-matching runs automatically when a member declines — finds another INVITED cohort in the same city or creates a waitlist. `createEventForCohort` enforced by city's min-confirmed threshold.

**Tech Stack:** NestJS + Prisma (API), OpenAI SDK v6 (already installed), TwilioService (SMS), existing CohortService + AutomationService.

**Repos:**
- API: `/Users/rentamac/Projects/growsober/growsober-api`
- Admin: `/Users/rentamac/Projects/growsober/growsober-intake-admin`

---

## File Structure

### API (`growsober-api`)

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add CitySettings model |
| `src/modules/crm/dto/index.ts` | Add CitySettings DTOs |
| `src/modules/crm/smart-matching.service.ts` | OpenAI-powered group formation: score pairs, optimize groups |
| `src/modules/crm/sms-rsvp.service.ts` | Parse inbound SMS for RSVP intent, match to cohort member, trigger RSVP |
| `src/modules/crm/city-settings.service.ts` | CRUD for per-city settings (min confirmed, default location) |
| `src/modules/crm/cohort.service.ts` | Modify: use SmartMatchingService, enforce min-confirmed, re-matching |
| `src/modules/phone-intake/sms-webhook.controller.ts` | Modify: route RSVP replies to SmsRsvpService |
| `src/modules/crm/crm-admin.controller.ts` | Add city-settings + re-match endpoints |
| `src/modules/crm/crm.module.ts` | Register new services |

### Admin (`growsober-intake-admin`)

| File | Responsibility |
|------|---------------|
| `lib/api.ts` | Add CitySettings types + API functions |
| `app/crm/settings/page.tsx` | City settings management page |
| `components/layout/Sidebar.tsx` | Add Settings nav link |

---

## Data Model

### CitySettings (per-city configuration)

```prisma
model CitySettings {
  id                String   @id @default(uuid())
  city              String   @unique  // e.g. "Lisbon", "London"
  minConfirmed      Int      @default(3)  // minimum RSVPs before event can be created
  defaultLocation   String?  // default meetup spot for this city
  defaultNotes      String?  // default event description
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("city_settings")
}
```

---

## How Smart Matching Works

### Current (greedy nearest-neighbor)
```
Leads sorted by interest overlap → chunk into groups of 3-5
```

### New (OpenAI-powered)
```
1. Fetch all eligible MATCHED leads for a city
2. Build a profile summary for each: name, interests, sobriety status, tags
3. Send to OpenAI: "Given these N people, form optimal groups of 3-5 for
   a sober social meetup. Consider shared interests, sobriety stage
   compatibility, and personality diversity. Return groups as JSON."
4. Parse response → create cohorts
5. Fallback: if OpenAI fails, use existing greedy algorithm
```

The prompt will be something like:
```
You are matching people into small groups (3-5) for in-person sober social
meetups in {{city}}. Each person has interests, a sobriety status, and
optional tags. Form groups that maximize:
- Shared interests (people who'd enjoy the same activity)
- Sobriety stage compatibility (don't mix brand-new with long-term)
- Personality diversity (mix introverts/extroverts if possible from tags)

People: [JSON array of lead profiles]

Return JSON: { "groups": [{ "memberIds": ["id1","id2","id3"], "reason": "..." }] }
```

---

## How SMS RSVP Parsing Works

```
Member receives: "Hey Alex! We matched you with Sarah, Marco.
                  Reply YES to confirm or NO to decline."

Member texts back: "Yes" / "YES" / "yeah" / "confirm" / "no" / "can't make it"

Webhook receives inbound SMS → SmsRsvpService:
1. Look up phone number in CohortMember (via lead.phone)
   WHERE cohort.status = INVITED AND rsvpStatus = PENDING
2. If found, classify intent:
   - Simple keyword match first: YES/CONFIRM/YEAH → CONFIRMED
   - NO/DECLINE/CANCEL/CAN'T → DECLINED
   - Ambiguous → use OpenAI to classify: "Is this a yes or no? Text: '{{message}}'"
3. Call cohortService.updateMemberRsvp(memberId, status)
4. If DECLINED → trigger re-matching
```

---

## How Re-matching Works

When a member declines:
1. Check if there are other INVITED cohorts in the same city with < maxSize members
2. If yes → add the declined member to the best-fit cohort (by interests)
3. If no → add to a "waitlist" (tag the lead with `rematch-pending`)
4. Next time `generateCohorts` runs, waitlisted leads are included

---

### Task 1: Prisma Schema — Add CitySettings model

**Files:**
- Modify: `growsober-api/prisma/schema.prisma`

- [ ] **Step 1: Add CitySettings model**

Add after the CohortMember model:

```prisma
model CitySettings {
  id              String   @id @default(uuid())
  city            String   @unique
  minConfirmed    Int      @default(3)
  defaultLocation String?
  defaultNotes    String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("city_settings")
}
```

- [ ] **Step 2: Generate + push**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
npx prisma generate
npx prisma db push
# Push to prod:
vercel env pull .env.vercel-prod --environment production
export $(grep DATABASE_URL .env.vercel-prod | xargs) && npx prisma db push
rm .env.vercel-prod
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add CitySettings model for per-city cohort configuration"
```

---

### Task 2: DTOs — CitySettings + SmartMatching

**Files:**
- Modify: `growsober-api/src/modules/crm/dto/index.ts`

- [ ] **Step 1: Add DTOs**

```typescript
// ============================================================================
// City Settings DTOs
// ============================================================================

export class CreateCitySettingsDto {
  @ApiProperty({ example: 'Lisbon' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  minConfirmed?: number;

  @ApiPropertyOptional({ example: 'The Sober Cafe, Rua Augusta 45' })
  @IsOptional()
  @IsString()
  defaultLocation?: string;

  @ApiPropertyOptional({ example: 'Casual coffee meetup for the crew' })
  @IsOptional()
  @IsString()
  defaultNotes?: string;
}

export class UpdateCitySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  minConfirmed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 2: Commit**

---

### Task 3: CitySettings Service

**Files:**
- Create: `growsober-api/src/modules/crm/city-settings.service.ts`

- [ ] **Step 1: Create service**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class CitySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.citySettings.findMany({
      where: { isActive: true },
      orderBy: { city: 'asc' },
    });
  }

  async getForCity(city: string) {
    return this.prisma.citySettings.findFirst({
      where: {
        city: { equals: city, mode: 'insensitive' },
        isActive: true,
      },
    });
  }

  async getMinConfirmed(city: string): Promise<number> {
    const settings = await this.getForCity(city);
    return settings?.minConfirmed ?? 3; // default 3
  }

  async create(dto: { city: string; minConfirmed?: number; defaultLocation?: string; defaultNotes?: string }) {
    return this.prisma.citySettings.create({
      data: {
        city: dto.city,
        minConfirmed: dto.minConfirmed ?? 3,
        defaultLocation: dto.defaultLocation,
        defaultNotes: dto.defaultNotes,
      },
    });
  }

  async update(id: string, dto: { minConfirmed?: number; defaultLocation?: string; defaultNotes?: string; isActive?: boolean }) {
    return this.prisma.citySettings.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    await this.prisma.citySettings.delete({ where: { id } });
    return { success: true };
  }
}
```

- [ ] **Step 2: Commit**

---

### Task 4: Smart Matching Service (OpenAI-powered)

**Files:**
- Create: `growsober-api/src/modules/crm/smart-matching.service.ts`

- [ ] **Step 1: Create service**

This service replaces the greedy `clusterByInterests` with an OpenAI call that considers interests, sobriety status, and personality fit. Falls back to simple clustering if OpenAI fails.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface LeadProfile {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  interests: string[];
  sobrietyStatus: string | null;
  tags: string[];
}

interface MatchGroup {
  memberIds: string[];
  reason: string;
}

@Injectable()
export class SmartMatchingService {
  private readonly logger = new Logger(SmartMatchingService.name);
  private readonly openai: OpenAI | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async formGroups(
    leads: LeadProfile[],
    city: string,
    minSize: number,
    maxSize: number,
  ): Promise<MatchGroup[]> {
    if (!this.openai || leads.length < minSize) {
      return this.fallbackGrouping(leads, minSize, maxSize);
    }

    try {
      const profiles = leads.map((l) => ({
        id: l.id,
        name: l.name || 'Anonymous',
        interests: l.interests.filter((i) => !i.startsWith('Frequency:')),
        sobrietyStatus: l.sobrietyStatus || 'unknown',
        tags: l.tags,
      }));

      const prompt = `You are matching people into small groups for in-person sober social meetups in ${city}.

Each group should have ${minSize}-${maxSize} people. Optimize for:
1. Shared interests (people who'd enjoy the same activity together)
2. Sobriety stage compatibility (similar stages work best)
3. Everyone must be in exactly one group
4. If there aren't enough people for a full group, merge the remainder into the closest group

People:
${JSON.stringify(profiles, null, 2)}

Return ONLY valid JSON, no markdown:
{"groups":[{"memberIds":["id1","id2","id3"],"reason":"short explanation"}]}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty OpenAI response');

      const parsed = JSON.parse(content) as { groups: MatchGroup[] };

      // Validate all lead IDs are accounted for
      const allIds = new Set(leads.map((l) => l.id));
      const groupedIds = new Set(parsed.groups.flatMap((g) => g.memberIds));
      const missing = [...allIds].filter((id) => !groupedIds.has(id));

      if (missing.length > 0) {
        this.logger.warn(`OpenAI missed ${missing.length} leads, adding to last group`);
        if (parsed.groups.length > 0) {
          parsed.groups[parsed.groups.length - 1].memberIds.push(...missing);
        } else {
          parsed.groups.push({ memberIds: missing, reason: 'Ungrouped leads' });
        }
      }

      this.logger.log(`AI formed ${parsed.groups.length} groups for ${city} from ${leads.length} leads`);
      return parsed.groups;
    } catch (err: any) {
      this.logger.error(`Smart matching failed, using fallback: ${err.message}`);
      return this.fallbackGrouping(leads, minSize, maxSize);
    }
  }

  /**
   * Fallback: greedy nearest-neighbor by shared interests (original algorithm)
   */
  private fallbackGrouping(leads: LeadProfile[], minSize: number, maxSize: number): MatchGroup[] {
    if (leads.length < minSize) return [];

    const sorted = this.clusterByInterests(leads);
    const groups: MatchGroup[] = [];

    for (let i = 0; i < sorted.length; i += maxSize) {
      const chunk = sorted.slice(i, i + maxSize);
      if (chunk.length < minSize && groups.length > 0) {
        groups[groups.length - 1].memberIds.push(...chunk.map((l) => l.id));
      } else if (chunk.length >= minSize) {
        groups.push({
          memberIds: chunk.map((l) => l.id),
          reason: `Grouped by shared interests: ${chunk[0].interests.slice(0, 3).join(', ')}`,
        });
      }
    }

    return groups;
  }

  private clusterByInterests(leads: LeadProfile[]): LeadProfile[] {
    if (leads.length <= 1) return leads;
    const remaining = [...leads];
    const sorted: LeadProfile[] = [remaining.shift()!];

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

  /**
   * Classify an SMS message as RSVP intent
   */
  async classifyRsvpIntent(message: string): Promise<'CONFIRMED' | 'DECLINED' | 'UNKNOWN'> {
    const lower = message.toLowerCase().trim();

    // Fast keyword match first
    if (/^(yes|yeah|yep|yup|confirm|sure|ok|okay|i'm in|im in|count me in|absolutely|definitely)$/i.test(lower)) {
      return 'CONFIRMED';
    }
    if (/^(no|nah|nope|decline|cancel|can't|cant|sorry|pass|not this time|i can't)$/i.test(lower)) {
      return 'DECLINED';
    }

    // Ambiguous — use OpenAI
    if (!this.openai) return 'UNKNOWN';

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Classify this SMS reply as either CONFIRMED, DECLINED, or UNKNOWN. The person was invited to a sober social meetup and asked to reply YES or NO.\n\nMessage: "${message}"\n\nRespond with ONLY one word: CONFIRMED, DECLINED, or UNKNOWN`,
        }],
        temperature: 0,
        max_tokens: 10,
      });

      const result = response.choices[0]?.message?.content?.trim().toUpperCase();
      if (result === 'CONFIRMED' || result === 'DECLINED') return result;
      return 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
```

- [ ] **Step 2: Commit**

---

### Task 5: SMS RSVP Service (automated reply parsing)

**Files:**
- Create: `growsober-api/src/modules/crm/sms-rsvp.service.ts`

- [ ] **Step 1: Create service**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { CohortService } from './cohort.service';
import { SmartMatchingService } from './smart-matching.service';
import { normalizePhone } from '@common/utils/phone.utils';

@Injectable()
export class SmsRsvpService {
  private readonly logger = new Logger(SmsRsvpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortService: CohortService,
    private readonly smartMatching: SmartMatchingService,
  ) {}

  /**
   * Handle an inbound SMS that might be an RSVP reply.
   * Returns true if it was handled as RSVP, false if not (pass to other handlers).
   */
  async handleInboundSms(fromPhone: string, messageBody: string): Promise<boolean> {
    const phone = normalizePhone(fromPhone);

    // Find a pending RSVP for this phone number
    const pendingMember = await this.prisma.cohortMember.findFirst({
      where: {
        lead: { phone },
        rsvpStatus: 'PENDING',
        cohort: { status: 'INVITED' },
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        cohort: { select: { id: true, name: true, city: true } },
      },
    });

    if (!pendingMember) return false;

    // Classify intent
    const intent = await this.smartMatching.classifyRsvpIntent(messageBody);

    if (intent === 'UNKNOWN') {
      this.logger.warn(`Ambiguous RSVP from ${phone}: "${messageBody}"`);
      return false; // Let other handlers process it
    }

    // Update RSVP
    await this.cohortService.updateMemberRsvp(
      pendingMember.id,
      intent,
      intent === 'DECLINED' ? `SMS reply: ${messageBody}` : undefined,
    );

    this.logger.log(`Auto-RSVP: ${phone} → ${intent} for cohort "${pendingMember.cohort.name}"`);

    // If declined, trigger re-matching
    if (intent === 'DECLINED') {
      await this.handleRematch(pendingMember.lead.id, pendingMember.cohort.city);
    }

    return true;
  }

  /**
   * Re-match a declined member to another cohort in the same city,
   * or tag them for next generation run.
   */
  async handleRematch(leadId: string, city: string | null) {
    if (!city) return;

    // Find other INVITED cohorts in the same city with room
    const availableCohorts = await this.prisma.cohort.findMany({
      where: {
        status: 'INVITED',
        city: { equals: city, mode: 'insensitive' },
        members: { none: { leadId } }, // not already a member
      },
      include: {
        members: true,
      },
    });

    // Find one with fewer than 5 members
    const target = availableCohorts.find((c) => c.members.length < 5);

    if (target) {
      // Add to existing cohort
      await this.prisma.cohortMember.create({
        data: { cohortId: target.id, leadId, rsvpStatus: 'PENDING' },
      });
      this.logger.log(`Re-matched lead ${leadId} to cohort "${target.name}"`);
    } else {
      // Tag for next generation run
      const lead = await this.prisma.phoneIntakeLead.findUnique({ where: { id: leadId } });
      if (lead && !lead.tags.includes('rematch-pending')) {
        await this.prisma.phoneIntakeLead.update({
          where: { id: leadId },
          data: { tags: { push: 'rematch-pending' } },
        });
        this.logger.log(`Tagged lead ${leadId} as rematch-pending for next cohort generation`);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

---

### Task 6: Modify CohortService — Use smart matching + enforce min-confirmed

**Files:**
- Modify: `growsober-api/src/modules/crm/cohort.service.ts`

- [ ] **Step 1: Inject SmartMatchingService and CitySettingsService**

Add to constructor:
```typescript
private readonly smartMatching: SmartMatchingService,
private readonly citySettings: CitySettingsService,
```

- [ ] **Step 2: Replace generateCohorts algorithm**

In `generateCohorts()`, replace the old city-loop + `clusterByInterests` with:

```typescript
// For each city, use SmartMatchingService
for (const [cityKey, cityLeads] of byCity) {
  if (cityLeads.length < minSize) continue;

  const cityName = cityLeads[0].city || cityKey;
  const settings = await this.citySettings.getForCity(cityName);
  const effectiveMin = settings?.minConfirmed ?? minSize;

  // Build profiles with sobriety status and tags for AI matching
  const profiles = await Promise.all(
    cityLeads.map(async (l) => {
      const lead = await this.prisma.phoneIntakeLead.findUnique({
        where: { id: l.id },
        select: { sobrietyStatus: true, tags: true },
      });
      return { ...l, sobrietyStatus: lead?.sobrietyStatus || null, tags: lead?.tags || [] };
    }),
  );

  const aiGroups = await this.smartMatching.formGroups(profiles, cityName, minSize, maxSize);
  // ... create cohorts from aiGroups
}
```

- [ ] **Step 3: Enforce min-confirmed in createEventForCohort**

In `createEventForCohort()`, before creating the event:
```typescript
const minConfirmed = await this.citySettings.getMinConfirmed(cohort.city || '');
const confirmedCount = cohort.members.filter((m) => m.rsvpStatus === 'CONFIRMED').length;
if (confirmedCount < minConfirmed) {
  throw new BadRequestException(
    `Need at least ${minConfirmed} confirmed RSVPs (have ${confirmedCount}) for ${cohort.city}`,
  );
}
```

- [ ] **Step 4: Apply city defaults when confirming**

In `confirmCohort()`, if location/notes not provided, use city defaults:
```typescript
const settings = await this.citySettings.getForCity(/* cohort city */);
const location = eventLocation || settings?.defaultLocation;
const notes = eventNotes || settings?.defaultNotes;
```

- [ ] **Step 5: Remove old clusterByInterests method** (moved to SmartMatchingService as fallback)

- [ ] **Step 6: Commit**

---

### Task 7: Modify SMS Webhook — Route RSVP replies

**Files:**
- Modify: `growsober-api/src/modules/phone-intake/sms-webhook.controller.ts`

- [ ] **Step 1: Inject SmsRsvpService**

Add `SmsRsvpService` to the controller constructor. Import from CRM module.

- [ ] **Step 2: Add RSVP check before existing handler**

In `handleSmsWebhook()`, before calling `smsIntakeService.handleIncomingSms()`:

```typescript
// Check if this is an RSVP reply first
const isRsvp = await this.smsRsvpService.handleInboundSms(from, smsBody);
if (isRsvp) {
  res.set('Content-Type', 'text/xml');
  return res.send('<Response></Response>');
}

// Not an RSVP — proceed with existing SMS intake flow
```

- [ ] **Step 3: Update module imports**

Ensure the PhoneIntakeModule imports CrmModule (or the specific service) so SmsRsvpService is injectable.

- [ ] **Step 4: Commit**

---

### Task 8: Controller endpoints + module wiring

**Files:**
- Modify: `growsober-api/src/modules/crm/crm-admin.controller.ts`
- Modify: `growsober-api/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Add city settings endpoints**

```typescript
// ============================================================================
// City Settings
// ============================================================================

@Get('city-settings')
@ApiOperation({ summary: 'List all city settings' })
async listCitySettings() { return this.citySettingsService.getAll(); }

@Post('city-settings')
@ApiOperation({ summary: 'Create city settings' })
async createCitySettings(@Body() dto: CreateCitySettingsDto) {
  return this.citySettingsService.create(dto);
}

@Patch('city-settings/:id')
@ApiOperation({ summary: 'Update city settings' })
async updateCitySettings(@Param('id') id: string, @Body() dto: UpdateCitySettingsDto) {
  return this.citySettingsService.update(id, dto);
}

@Delete('city-settings/:id')
@ApiOperation({ summary: 'Delete city settings' })
async deleteCitySettings(@Param('id') id: string) {
  return this.citySettingsService.delete(id);
}
```

- [ ] **Step 2: Add re-match endpoint**

```typescript
@Post('cohort-members/:id/rematch')
@ApiOperation({ summary: 'Re-match a declined member to another cohort' })
async rematchMember(@Param('id') id: string) {
  const member = await this.prisma.cohortMember.findUniqueOrThrow({
    where: { id },
    include: { cohort: true },
  });
  return this.smsRsvpService.handleRematch(member.leadId, member.cohort.city);
}
```

- [ ] **Step 3: Register all new services in crm.module.ts**

Add `SmartMatchingService`, `SmsRsvpService`, `CitySettingsService` to providers and exports.

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

- [ ] **Step 5: Commit**

---

### Task 9: API — Build, deploy, push schema, seed city settings

- [ ] **Step 1: Build + push schema + deploy**

```bash
cd /Users/rentamac/Projects/growsober/growsober-api
npm run build && git push origin main
vercel env pull .env.vercel-prod --environment production
export $(grep DATABASE_URL .env.vercel-prod | xargs) && npx prisma db push
rm .env.vercel-prod
npx vercel --prod --yes
```

- [ ] **Step 2: Seed default city settings**

```bash
API_KEY="0bd4cb1420cc3a2064efbdf49aab823148efe74e37faa4f42aaa25b21f9f5d54"

curl -X POST https://growsober-api.vercel.app/api/v1/crm/city-settings \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"city":"Lisbon","minConfirmed":3,"defaultLocation":"The Sober Cafe, Rua Augusta 45","defaultNotes":"Casual coffee meetup for the crew"}'

curl -X POST https://growsober-api.vercel.app/api/v1/crm/city-settings \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"city":"London","minConfirmed":3,"defaultLocation":"The Sober Social, Shoreditch","defaultNotes":"Chill hangout in East London"}'
```

- [ ] **Step 3: Verify**

```bash
curl -s -H "x-api-key: $API_KEY" https://growsober-api.vercel.app/api/v1/crm/city-settings
```

---

### Task 10: Admin Frontend — API client + City Settings page

**Files:**
- Modify: `growsober-intake-admin/lib/api.ts`
- Create: `growsober-intake-admin/app/crm/settings/page.tsx`
- Modify: `growsober-intake-admin/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add types and functions to api.ts**

```typescript
export interface CitySettings {
  id: string;
  city: string;
  minConfirmed: number;
  defaultLocation: string | null;
  defaultNotes: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function getCitySettings(): Promise<CitySettings[]> { ... }
export async function createCitySettings(dto: { city: string; minConfirmed?: number; defaultLocation?: string; defaultNotes?: string }): Promise<CitySettings> { ... }
export async function updateCitySettings(id: string, dto: Partial<CitySettings>): Promise<CitySettings> { ... }
export async function deleteCitySettings(id: string) { ... }
```

- [ ] **Step 2: Create settings page**

Table with: City, Min Confirmed, Default Location, Default Notes, Actions (Edit/Delete). Add City form at top.

- [ ] **Step 3: Add sidebar link**

```typescript
{ href: '/crm/settings', label: 'Settings', icon: Settings },
```

- [ ] **Step 4: Build + deploy admin**

- [ ] **Step 5: Commit**

---

### Task 11: E2E tests

- [ ] **Step 1: Add E2E tests for city settings page**
- [ ] **Step 2: Verify all existing tests still pass**
- [ ] **Step 3: Commit**

---

## Implementation Order

```
Task 1:  Prisma schema (CitySettings)           — foundation
Task 2:  DTOs                                    — depends on 1
Task 3:  CitySettingsService                     — depends on 1
Task 4:  SmartMatchingService (OpenAI)           — independent
Task 5:  SmsRsvpService                          — depends on 4
Task 6:  Modify CohortService                    — depends on 3, 4, 5
Task 7:  Modify SMS Webhook                      — depends on 5
Task 8:  Controller + Module                     — depends on 3, 5, 6, 7
Task 9:  Build + Deploy + Seed                   — depends on 1-8
Task 10: Admin Frontend                          — depends on 9
Task 11: E2E Tests                               — depends on 10
```

Tasks 3-5 can be parallelized. Task 10-11 can be parallelized.
