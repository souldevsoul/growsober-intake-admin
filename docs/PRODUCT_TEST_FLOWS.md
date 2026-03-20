# GrowSober CRM — Product Test Flows

Manual testing guide for QA. Each flow should be tested end-to-end on the deployed admin dashboard.

**Admin URL:** https://growsober-intake-admin.vercel.app
**API URL:** https://growsober-api.vercel.app

---

## Flow 1: Lead Management

### 1.1 View & Filter Leads
- [ ] Navigate to `/crm` (Leads page)
- [ ] Verify 15+ leads load in the table with columns: Name, Phone, City, Status, Source, Tags, Drip, When
- [ ] Test search: type a name → verify filtered results → clear → verify all leads return
- [ ] Test status filter: select "MATCHED" → verify only matched leads shown
- [ ] Test source filter: select "SMS" → verify filtered results
- [ ] Verify lead count badge updates with filters

### 1.2 Pipeline / Kanban View
- [ ] Click "Pipeline" toggle → verify 6 columns: CALLED, INFO COLLECTED, LINK SENT, PAID, MATCHED, FAILED
- [ ] Verify cards show name, phone, first tag
- [ ] Verify column counts add up to total leads
- [ ] Click "Table" to switch back → verify table returns

### 1.3 Lead Detail Page
- [ ] Click a lead row → verify navigation to `/crm/leads/{id}`
- [ ] Verify header: name, phone, status dropdown, source badge, **Score badge**, **Engagement badge**
- [ ] Verify info cards: City, Sobriety Status, Interests, Tags, **Preferred Days**
- [ ] Verify Payment section (Paid/Unpaid badge)
- [ ] Verify **Timeline section** with type filter dropdown (all, note, sms, automation, cohort)
- [ ] Verify Activity section with note input
- [ ] Verify SMS Conversation section
- [ ] Verify Drip Enrollments table
- [ ] Click "Back" → verify return to leads list

### 1.4 Add a Note
- [ ] On lead detail, type in "Add a note..." input
- [ ] Verify "Add" button enables
- [ ] Click Add → verify note appears in activity feed AND in timeline
- [ ] Refresh page → verify note persists

### 1.5 Preferred Days Editor
- [ ] On lead detail, find "Preferred Days" card
- [ ] Click day buttons (Mon, Wed, Sat) → verify they toggle on/off
- [ ] Refresh page → verify selections persist

### 1.6 Tags
- [ ] On lead detail or in the table, type a tag in "Add tag..." input
- [ ] Press Enter → verify tag appears
- [ ] Click X on a tag → verify it's removed

### 1.7 Bulk Operations
- [ ] On leads table, select 2+ checkboxes
- [ ] Verify bulk action bar appears (tag input, enroll dropdown)
- [ ] Type a tag and click "Add Tag" → verify tags added to all selected

### 1.8 CSV Export
- [ ] Open in new tab: `https://growsober-api.vercel.app/api/v1/crm/leads/export?limit=100` (with API key header)
- [ ] Verify CSV downloads with headers: Name, Phone, City, Status, Source, Tags, Score, Created

---

## Flow 2: Segments

### 2.1 Save a Segment
- [ ] On leads page, apply a filter (e.g., status = MATCHED)
- [ ] Verify "Save filters" button appears in segment bar
- [ ] Click → enter name → verify segment pill appears

### 2.2 Apply a Segment
- [ ] Click a saved segment pill → verify filters auto-apply
- [ ] Verify table updates to show matching leads

### 2.3 Delete a Segment
- [ ] Hover over segment pill → click X → verify deleted

---

## Flow 3: Drip Sequences

### 3.1 View Sequences
- [ ] Navigate to "Sequences" in sidebar
- [ ] Verify sequences list (e.g., "Founding Crew Welcome" with 4 steps, 9 enrolled)

### 3.2 Sequence Detail
- [ ] Click a sequence → verify detail page loads
- [ ] Verify steps table with step number, delay, channel, content
- [ ] Verify enrollments list with lead name, current step, status

---

## Flow 4: Automations

### 4.1 View Automation Rules
- [ ] Navigate to "Automations" in sidebar
- [ ] Verify 5 seeded rules: Cohort Invitation, RSVP Confirmed, RSVP Declined, 24h Event Reminder, Post-Event Thank You
- [ ] Verify each shows: trigger badge (color-coded), SMS badge, Active/Edit/Delete buttons
- [ ] Verify message template displayed with **{{placeholders}} highlighted**

### 4.2 Analytics Summary
- [ ] Verify analytics cards at top showing: total sent, delivery rate %, sent/failed per automation
- [ ] Verify color coding: green (>90%), yellow (70-90%), red (<70%)

### 4.3 Edit an Automation
- [ ] Click "Edit" on any automation → verify inline edit form (name + template textarea)
- [ ] Change the template text → click "Save" → verify updated text shown
- [ ] Refresh page → verify change persists

### 4.4 Toggle Active/Inactive
- [ ] Click "Active" → verify changes to "Inactive"
- [ ] Click "Inactive" → verify changes back to "Active"

### 4.5 Create New Automation
- [ ] Click "Add Automation" → verify form appears
- [ ] Fill: name, select trigger, select channel, write template
- [ ] If trigger = HOURS_BEFORE_EVENT, verify hours input appears
- [ ] Submit → verify new automation card appears

### 4.6 Retry Failed SMS
- [ ] In automation logs, find a failed entry
- [ ] Call retry endpoint via API → verify status updates

---

## Flow 5: Cohort Matching & Events

### 5.1 Generate Cohorts
- [ ] Navigate to "Cohorts" in sidebar
- [ ] Click "Generate Cohorts" → verify cohort cards appear grouped by city
- [ ] Verify each card shows: name, city, status (DRAFT), member count, member name pills

### 5.2 Confirm a Cohort
- [ ] On a DRAFT cohort, click "Confirm"
- [ ] Enter event date and location (or verify city defaults auto-fill if left empty)
- [ ] Submit → verify status changes to CONFIRMED

### 5.3 Send Invitations
- [ ] On a CONFIRMED cohort, click "Send Invitations"
- [ ] Verify status changes to INVITED
- [ ] Verify automation logs show COHORT_INVITED entries for each member

### 5.4 RSVP Management
- [ ] Click into a cohort detail page
- [ ] For PENDING members, click "Confirm" or "Decline"
- [ ] Verify RSVP status badges update (green for confirmed, red for declined)
- [ ] Verify RSVP summary text updates ("3 confirmed, 1 declined")

### 5.5 Min-Confirmed Threshold
- [ ] Try to create event on a cohort with fewer confirmed than the city's minConfirmed
- [ ] Verify error message: "Need at least X confirmed RSVPs"

### 5.6 Create Event
- [ ] On an INVITED cohort with enough confirmed RSVPs, click "Create Event"
- [ ] Verify status changes to EVENT_CREATED
- [ ] Verify event details shown (title, date, location)

### 5.7 Send Reminders
- [ ] Click "Send Reminders" → verify reminderSentAt timestamp updates

### 5.8 Mark Attendance
- [ ] On EVENT_CREATED cohort, toggle attendance checkboxes for members
- [ ] Verify checked state persists

### 5.9 Complete Cohort
- [ ] Click "Complete" → verify status changes to COMPLETED
- [ ] Verify EVENT_COMPLETED automation logs appear

### 5.10 Recreate Cohort (Recurring)
- [ ] On a COMPLETED cohort, click "Recreate Cohort"
- [ ] Verify new DRAFT cohort created with returning members + new MATCHED leads
- [ ] Verify new cohort has incremented name (e.g., "Lisbon Crew #4")

---

## Flow 6: Cohort Chat

### 6.1 View Chat
- [ ] On a cohort detail page, scroll to "Cohort Chat" section
- [ ] Verify empty state or existing messages

### 6.2 Send Message
- [ ] Type a message in the chat input → click Send
- [ ] Verify message appears as a chat bubble with sender name and timestamp
- [ ] Refresh page → verify message persists

---

## Flow 7: SMS RSVP (Automated)

### 7.1 Inbound Reply Parsing
- [ ] After sending invitations, have a real phone number text "YES" or "NO" to the Twilio number
- [ ] Verify the CohortMember RSVP status auto-updates
- [ ] Verify automation log shows RSVP_CONFIRMED or RSVP_DECLINED

### 7.2 Ambiguous Reply
- [ ] Text something ambiguous like "maybe later"
- [ ] Verify OpenAI classifies intent or returns UNKNOWN (no auto-update)

---

## Flow 8: City Settings

### 8.1 View Settings
- [ ] Navigate to "Settings" in sidebar
- [ ] Verify table shows seeded cities: Lisbon (min 3), London (min 3), Manchester (min 2)

### 8.2 Edit Settings
- [ ] Click "Edit" on a city → change minConfirmed → Save
- [ ] Verify updated value shown
- [ ] Test: generate a cohort in that city → verify new threshold applies

### 8.3 Add New City
- [ ] Click "Add City" → fill city name, min confirmed, location, notes
- [ ] Submit → verify new row appears

---

## Flow 9: Analytics

### 9.1 Lead Funnel
- [ ] Navigate to "Analytics" in sidebar
- [ ] Verify "Lead Funnel" section shows bars for: CALLED → INFO_COLLECTED → LINK_SENT → PAID → MATCHED → FAILED
- [ ] Verify conversion rate percentages between stages
- [ ] Verify bar widths proportional to counts

### 9.2 Source Attribution
- [ ] Verify cards for each source: CALL, SMS, WEB_FORM, WEB_WAITLIST
- [ ] Each shows: total leads, matched leads, conversion rate %

### 9.3 Cohort Funnel
- [ ] Verify "Cohort Funnel" section shows: MATCHED → IN_COHORT → INVITED → CONFIRMED → ATTENDED
- [ ] Verify numbers match real data

---

## Flow 10: NPS Surveys

### 10.1 Send NPS
- [ ] On a COMPLETED cohort detail page, find "NPS Survey" section
- [ ] Click "Send NPS Survey"
- [ ] Verify surveys created for attended members
- [ ] Verify NPS_SURVEY automation fires (check automation logs)

### 10.2 View NPS Results
- [ ] After responses recorded, verify NPS section shows: total responses, average score, NPS score
- [ ] Test via API: POST to `/crm/nps/{surveyId}/respond` with score 1-10

---

## Flow 11: Community Engagement Score

### 11.1 View Score
- [ ] On lead detail, verify "Engagement" badge shows a number 0-100
- [ ] Members with more events attended should have higher scores

### 11.2 Recalculate
- [ ] Call POST `/crm/scores/recalculate` via API
- [ ] Verify scores update on lead detail pages

---

## Flow 12: Navigation & Design

### 12.1 Sidebar Navigation
- [ ] Verify all 8 sidebar links work: Dashboard, Leads, Sequences, Scheduled, Cohorts, Automations, Analytics, Settings
- [ ] Verify active link is highlighted with left border

### 12.2 Neon Grid Design
- [ ] Verify mountain logo "GROW SOBER" in sidebar
- [ ] Verify pure black background with subtle grid dot pattern
- [ ] Verify sharp corners on cards (not rounded-2xl)
- [ ] Verify thin white borders on cards
- [ ] Verify uppercase letter-spaced status badges
- [ ] Verify DM Sans font throughout

---

## Test Summary Checklist

| Flow | Area | Priority |
|------|------|----------|
| 1.1-1.8 | Lead Management | **Critical** |
| 2.1-2.3 | Segments | Medium |
| 3.1-3.2 | Drip Sequences | Medium |
| 4.1-4.6 | Automations | **Critical** |
| 5.1-5.10 | Cohort Matching | **Critical** |
| 6.1-6.2 | Cohort Chat | Medium |
| 7.1-7.2 | SMS RSVP Auto | **Critical** |
| 8.1-8.3 | City Settings | Medium |
| 9.1-9.3 | Analytics | High |
| 10.1-10.2 | NPS | Medium |
| 11.1-11.2 | Engagement Score | Low |
| 12.1-12.2 | Design & Nav | High |

**Total test cases: 45+**
