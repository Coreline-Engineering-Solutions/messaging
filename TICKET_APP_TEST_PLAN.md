# CES Ticketing App Test Plan

This checklist covers the user-facing functionality in `ticketing-app`. It is written for manual QA testers and should be used after each frontend or API deployment.

## Scope

Test these areas:

- App shell, navigation, settings menu, filters, sorting, grouping, refresh, and notifications.
- Dashboard ticket list, inline updates, assignment changes, delete mode, ticket modal, tags, attachments, and service comments.
- New ticket form, validation, domain dropdowns, tags, attachment upload, and success/error states.
- Analytics page calculations and filter behavior.
- Messaging overlay from `@coreline-engineering-solutions/messaging`.
- File storage integration, profile pictures, and browser responsiveness.

## Test Environment

Use the deployed app URL and the deployed API:

- Ticket/API host: `https://ces-ticketing-system-db.onrender.com/api`
- Messaging REST base: `https://ces-ticketing-system-db.onrender.com/api`
- Messaging WS base: `wss://ces-ticketing-system-db.onrender.com/api`

Before testing:

- Use at least two real test users with valid `user_email` and `session_gid` cookies.
- Use one admin user and one non-admin user if possible.
- Have at least one ticket in each status where possible: `Open`, `In Progress`, `Awaiting Feedback`, `Closed`, `Reopened`.
- Have tickets with and without attachments.
- Have tickets with and without tags.
- Have tickets assigned to multiple people.
- Keep DevTools open for at least one browser session to catch console and network errors.

## Result Format

For each test case, record:

- `Pass` or `Fail`
- Browser and device
- User account tested
- Ticket reference or message ID used
- Screenshots/video for failures
- Console/network errors if any

## Smoke Tests

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| SMK-001 | App load | Open the app root URL. | User lands on `/dashboard`; header, footer, controls, and dashboard content render without blank screen. |
| SMK-002 | API connectivity | Refresh dashboard. | Tickets load from `/api/tickets`; no persistent API error banner. |
| SMK-003 | Navigation | Open Settings menu, then click Dashboard, Analytics, and New Ticket. | Each route loads correctly; active page content changes; no console errors. |
| SMK-004 | Browser refresh | Refresh browser on `/dashboard`, `/analytics`, and `/new`. | Current route reloads without broken state. |
| SMK-005 | Console | Use the app for five minutes. | No uncaught JavaScript errors; expected optional warnings only. |

## App Shell and Navigation

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| NAV-001 | Logo navigation | Click the CES logo. | User navigates to `/dashboard`. |
| NAV-002 | Settings menu | Click settings avatar/cog. | Dropdown opens with Dashboard, Analytics, New Ticket, Forms, Tags, and Main Dashboard links. |
| NAV-003 | Settings close | Click outside the settings menu. | Dropdown closes. |
| NAV-004 | Main Dashboard link | Click Main Dashboard. | Opens `https://www.corelineengineering.com/DashBoard` in a new tab. |
| NAV-005 | Header controls hidden on new ticket | Navigate to `/new`. | Search/filter/dashboard controls are hidden; notification/settings still available. |
| NAV-006 | Header controls on dashboard | Navigate to `/dashboard`. | Search/filter/expand/collapse/delete/refresh controls are visible. |
| NAV-007 | Header controls on analytics | Navigate to `/analytics`. | Search/filter/refresh controls are visible; Group by and Sort controls are hidden. |
| NAV-008 | Outside clicks | Open filters, notifications, or settings, then click page body. | Open dropdown/panel closes without changing data. |

## Authentication and User Session

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| AUTH-001 | User cookie | Log in with a valid user. | `user_email` cookie is present; app displays the correct current user avatar/initials. |
| AUTH-002 | Admin check | Load app as an admin user. | Notification bell appears once admin/user lookup completes. |
| AUTH-003 | Non-admin behavior | Load app as non-admin. | App remains usable; New Ticket form hides ticket type `Other`. |
| AUTH-004 | Missing cookies | Clear user cookies and reload. | App does not crash; user-specific notifications and messaging do not initialize. |
| AUTH-005 | Messaging session | Load app with valid `user_email` and `session_gid`. | Messaging session resolves numeric contact ID via `/api/messaging/contacts/by-email/{email}`. |

## Dashboard Loading and Display

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| DASH-001 | Initial loading | Open `/dashboard`. | Loading skeleton appears, then grouped tickets render. |
| DASH-002 | Empty data | Apply filters that match no tickets. | Empty state says no tickets found and offers Clear Filters. |
| DASH-003 | Error handling | Simulate API failure or network offline, then reload. | Error banner displays; app does not crash. |
| DASH-004 | Group headers | Review each group. | Group name, count, color stripe, expand/collapse icon, and ticket rows are correct. |
| DASH-005 | Group expand/collapse | Click a group header and toggle icon. | Group expands/collapses and row visibility updates. |
| DASH-006 | Expand all | Click Expand All. | All groups expand. |
| DASH-007 | Collapse all | Click Collapse All. | All groups collapse. |
| DASH-008 | Ticket columns | Inspect a ticket row. | Owner, ref, status, priority, type, tags, platform, requested by, and comments display correctly. |
| DASH-009 | Profile pictures | Inspect known users and unknown users. | Known users show profile pictures; unknown users show initials with generated color. |
| DASH-010 | Long text | Inspect long requester/comment/tag values. | Text truncates cleanly with tooltips where implemented; layout does not break. |
| DASH-011 | Refresh | Click refresh button. | Tickets reload; loading spinner appears; current route remains unchanged. |

## Dashboard Search, Filters, Grouping, and Sorting

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| FIL-001 | Search ticket ref | Search for an exact ticket ref. | Only matching ticket(s) remain. |
| FIL-002 | Search text fields | Search by requester, owner, comment, status, priority, department, platform, and pk. | Matching tickets appear for each searchable field. |
| FIL-003 | Clear search | Clear search text. | Previously visible tickets return. |
| FIL-004 | Filter panel | Click filter icon. | Filter panel opens. |
| FIL-005 | Status filter | Select one status. | Dashboard shows only tickets with that status. |
| FIL-006 | Multi-status filter | Select two statuses. | Dashboard shows tickets matching either selected status. |
| FIL-007 | Priority filter | Select one or more priorities. | Dashboard shows matching priorities only. |
| FIL-008 | Person filter | Select one or more people. | Dashboard shows matching assigned owners only. |
| FIL-009 | Department filter | Select one or more departments. | Dashboard shows matching departments only. |
| FIL-010 | Tag filter | Select a tag. | Dashboard shows tickets that have the selected tag. |
| FIL-011 | Combined filters | Combine status, priority, person, department, and tag. | Filters use AND logic across categories and OR logic inside each category. |
| FIL-012 | Cascading options | Select one filter, then inspect other dropdown options. | Available options narrow to values that exist with the current filter combination. |
| FIL-013 | Selected options stay visible | Select a value, then apply another filter that narrows options. | Already selected values remain selected and visible. |
| FIL-014 | Filter label | Select one value, then multiple values. | Label shows the value for one selection and `N selected` for multiple selections. |
| FIL-015 | Clear filters | Click Clear Filters. | All filters and search reset; dashboard shows full data set. |
| FIL-016 | Group by status | Select Group by Status. | Groups are statuses with status colors. |
| FIL-017 | Group by priority | Select Group by Priority. | Tickets regroup by priority. |
| FIL-018 | Group by type | Select Group by Type. | Tickets regroup by type. |
| FIL-019 | Group by department | Select Group by Department. | Tickets regroup by department. |
| FIL-020 | Group by platform | Select Group by Platform. | Tickets regroup by platform. |
| FIL-021 | Group by person | Select Group by Person Responsible. | Tickets regroup by assignee. |
| FIL-022 | Sort by created date | Sort by Date Created, toggle asc/desc. | Ticket order changes correctly. |
| FIL-023 | Sort by updated date | Sort by Date Updated, toggle asc/desc. | Ticket order changes correctly. |
| FIL-024 | Sort by ticket number | Sort by Ticket Number, toggle asc/desc. | Numeric part of ticket ref controls order. |
| FIL-025 | Sort by priority | Sort by Priority, toggle asc/desc. | Critical/High/Medium/Low order is correct. |
| FIL-026 | Persist across navigation | Apply filters, go to Analytics, then back Dashboard. | Dashboard receives current app-level filter values where supported. |

## Dashboard Inline Editing

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| EDIT-001 | Status update | Change a row status dropdown. | Spinner appears; API saves; toast confirms; group/count updates; previous status updates in modal. |
| EDIT-002 | Priority update | Change row priority. | Spinner appears; API saves; toast confirms; priority style updates. |
| EDIT-003 | Type update | Change row type. | API saves; row and modal show new value. |
| EDIT-004 | Platform update | Change row platform. | API saves; row and modal show new value. |
| EDIT-005 | No-op update | Select the same dropdown value. | No save request or visible error. |
| EDIT-006 | Failed update | Simulate save failure. | Value reverts; error toast appears; spinner clears. |
| EDIT-007 | Assignment avatar open | Click ticket owner avatar. | Avatar/person selector opens near clicked avatar. |
| EDIT-008 | Assignment save | Choose another person. | API saves; avatar and owner update; toast confirms; group/filter counts update if grouping/filtering by owner. |
| EDIT-009 | Assignment cancel | Open avatar selector, then click outside. | Selector closes without changing owner. |
| EDIT-010 | Concurrent edits | Quickly change two different tickets. | Each row shows independent saving state; no row overwrites another. |

## Bulk Delete

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| DEL-001 | Delete button availability | Navigate to Dashboard, then Analytics/New Ticket. | Delete mode button is enabled only on Dashboard. |
| DEL-002 | Enter delete mode | Click delete button on Dashboard. | Checkboxes and bulk action bar appear. |
| DEL-003 | Select one ticket | Select one ticket checkbox. | Row highlights; selected count updates. |
| DEL-004 | Select group | Use Select All in an expanded group. | All tickets in that group select; group checkbox state is correct. |
| DEL-005 | Partial selection | Select some tickets in a group. | Group checkbox shows partial/indeterminate state. |
| DEL-006 | Clear selection | Click Clear Selection. | All selections clear; delete action disables. |
| DEL-007 | Delete selected | Select test tickets and confirm delete. | Selected tickets are deleted via API and disappear from dashboard. |
| DEL-008 | Cancel delete confirmation | Start delete but cancel confirmation. | No tickets are deleted. |
| DEL-009 | Delete failure | Simulate failed delete for one ticket. | Failure is reported; remaining state is clear and no UI hang occurs. |

## Ticket Detail Modal

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| MOD-001 | Open from row | Click a ticket ref. | Full ticket modal opens and body scroll locks. |
| MOD-002 | Open from tag cell | Click tags cell. | Same modal opens for the ticket. |
| MOD-003 | Close button | Click close. | Modal closes; body scroll unlocks. |
| MOD-004 | Backdrop close | Click outside modal. | Modal closes. |
| MOD-005 | Refresh ticket | Click modal refresh. | Latest ticket data loads; spinner shows while loading. |
| MOD-006 | Modal status update | Change status in modal. | API saves; toast confirms; dashboard row updates when modal closes. |
| MOD-007 | Modal priority update | Change priority in modal. | API saves and UI updates. |
| MOD-008 | Modal type update | Change type in modal. | API saves and UI updates. |
| MOD-009 | Modal platform update | Change platform in modal. | API saves and UI updates. |
| MOD-010 | Modal department update | Change department in modal. | API saves and UI updates. |
| MOD-011 | Modal assignee update | Change Assigned To dropdown. | API saves; avatar/name update; dashboard row updates. |
| MOD-012 | Previous status | Change ticket status from A to B. | Previous Status displays A. |
| MOD-013 | Modal save failure | Simulate API failure. | Value reverts; error toast appears; spinner clears. |
| MOD-014 | Requested by display | Open modal for different users. | Requested By shows correct user and avatar/initials. |
| MOD-015 | User comments | Open ticket with and without comments. | Comments show full text or `No comments`. |

## Ticket Tags

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| TAG-001 | Dashboard tag display | View a ticket with no tags, one tag, two tags, and more than two tags. | No tag state, visible badges, and `+N more` indicator work correctly. |
| TAG-002 | Tag tooltip | Hover a ticket with more than two tags. | Tooltip/list shows all tags. |
| TAG-003 | Add tag in ticket modal | Open modal, click Add Tag, select a tag. | Tag is added via API; modal and dashboard row update. |
| TAG-004 | Search modal tags | Type in tag search box. | Available tags filter by search text and exclude already assigned tags. |
| TAG-005 | Remove tag from ticket | Remove a tag and confirm. | Tag disappears from modal and dashboard row. |
| TAG-006 | Cancel tag removal | Start remove and cancel confirmation. | Tag remains. |
| TAG-007 | Tag add failure | Simulate API failure. | Error is shown; tag is not added. |
| TAG-008 | Tag remove failure | Simulate API failure. | Error is shown; tag remains. |

## Attachments and File Storage

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| FILE-001 | Ticket with no attachments | Open ticket without attachments. | Attachments section is hidden. |
| FILE-002 | Image preview | Open ticket with image attachment. | Preview loads through storage retrieve endpoint; image displays. |
| FILE-003 | Image fullscreen | Click image preview. | Image opens in new browser tab/window. |
| FILE-004 | PDF/file icon | Open ticket with PDF, document, spreadsheet, archive, text, code, KML/KMZ. | Correct icon and file type label display. |
| FILE-005 | Download loaded file | Click Download for a loaded attachment. | Browser downloads file with correct filename. |
| FILE-006 | Download unloaded file | Click Download before preview finishes. | File is retrieved and downloaded. |
| FILE-007 | Failed retrieve | Simulate missing file or storage failure. | Broken/error placeholder appears; modal remains usable. |

## Service Comments

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| COM-001 | Empty comments | Open Service Comments tab on ticket with no messages. | Empty state displays. |
| COM-002 | Send button disabled | Leave message box empty. | Send button is disabled. |
| COM-003 | Send message | Type message and click send. | Spinner appears; message saves; message appears in chat history; input clears. |
| COM-004 | Ctrl+Enter send | Type message and press Ctrl+Enter. | Message sends. |
| COM-005 | Current user style | Send message as current user. | Message displays as self/current-user bubble. |
| COM-006 | Other user style | Open ticket with another user's messages. | Other user messages show avatar/initials and distinct bubble color. |
| COM-007 | Message timestamp | Inspect recent and older messages. | Timestamp format shows `Just now`, minutes, hours, days, or date as appropriate. |
| COM-008 | Unsent message cache | Type a message, close modal, reopen same ticket. | Draft message is restored. |
| COM-009 | Clear cache after send | Send restored draft successfully, close and reopen. | Draft is gone after successful send. |
| COM-010 | Send failure | Simulate API failure. | Input remains; error alert appears; spinner clears. |

## New Ticket Form

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| NEW-001 | Route load | Open `/new`. | Form loads; header dashboard controls are hidden. |
| NEW-002 | Domain dropdowns | Open Type, Department, and Platform dropdowns. | Active API options are listed. |
| NEW-003 | Non-admin type filtering | Open Type as non-admin. | `Other` is not available. |
| NEW-004 | Admin type options | Open Type as admin. | `Other` is available if active in API. |
| NEW-005 | Required validation | Submit empty form. | Required errors show for type, department, platform, and reporter if missing. |
| NEW-006 | Reporter field | Load form with `user_email` cookie. | Reported By is populated and read-only. |
| NEW-007 | Comments optional | Submit with and without comments. | Ticket can submit when required fields are valid. |
| NEW-008 | Add tag | Click Add Tag and choose a tag. | Tag badge appears in selected tags. |
| NEW-009 | Tag search | Search for a tag. | Available tag list filters; already selected tags are excluded. |
| NEW-010 | Remove selected tag | Remove selected tag. | Tag badge disappears and will not be included in submission. |
| NEW-011 | No tags available | Search for unmatched tag text. | `No tags available` message shows. |
| NEW-012 | File selection | Select one file. | File appears in selected file list. |
| NEW-013 | Multiple files | Select multiple files. | All selected files appear. |
| NEW-014 | Remove file | Remove one selected file. | File disappears and is not uploaded. |
| NEW-015 | Submit without files | Complete form and submit with no attachments. | Ticket creates successfully; success screen shows ticket ref. |
| NEW-016 | Submit with files | Complete form and submit with attachments. | Files upload first; ticket creates with attachment IDs and filenames. |
| NEW-017 | Submit with tags | Submit form with tags. | Created ticket has selected tags on dashboard/modal. |
| NEW-018 | Submit loading | Click submit. | Button disables and spinner appears while request is pending. |
| NEW-019 | API failure | Simulate ticket creation failure. | Error banner shows; form values remain. |
| NEW-020 | File upload failure | Simulate storage upload failure. | Error banner shows; ticket is not created. |
| NEW-021 | Log another ticket | After success, click Log Another Ticket. | Form resets; reporter remains populated; files/tags clear. |
| NEW-022 | Duplicate submit protection | Double-click Submit quickly. | Only one ticket should be created. |

## Notifications

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| NOTIF-001 | Badge count | Load app with assigned unseen tickets. | Notification badge shows unseen count from API. |
| NOTIF-002 | Polling | Wait at least 30 seconds after assignment/count changes. | Badge refreshes automatically. |
| NOTIF-003 | Open dropdown | Click notification bell. | Dropdown opens and loads current user's assigned tickets. |
| NOTIF-004 | Empty assigned tickets | Test user with no assigned tickets. | Empty notification state appears. |
| NOTIF-005 | Seen styling | Compare seen and unseen tickets. | Unseen tickets have highlighted styling and indicator. |
| NOTIF-006 | Mark one as seen | Click mark-as-read on one unseen ticket. | Ticket becomes seen; badge count decreases. |
| NOTIF-007 | Mark all as read | Click Mark All as Read. | All loaded tickets are marked seen; badge count becomes 0. |
| NOTIF-008 | Open ticket from notification | Click View Details. | Dropdown closes; dashboard opens if needed; ticket modal opens. |
| NOTIF-009 | My Tickets filter | Click My Tickets in dropdown. | Dashboard filters to current user's assigned tickets. |
| NOTIF-010 | Toggle My Tickets filter | Click My Tickets again when already filtered. | Person filter clears. |
| NOTIF-011 | Outside click | Open dropdown and click elsewhere. | Dropdown closes. |
| NOTIF-012 | API failure | Simulate notifications API failure. | Badge resets safely; no crash. |

## Settings Tags Modal

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| SETTAG-001 | Open tags modal | Settings > Tags. | Modal opens; body scroll locks; existing tags load. |
| SETTAG-002 | Close tags modal | Click close, Close button, or backdrop. | Modal closes; body scroll unlocks. |
| SETTAG-003 | Create disabled | Leave tag name blank. | Create Tag button is disabled. |
| SETTAG-004 | Create tag | Enter name, choose color, click Create Tag. | API creates tag; fields reset; new tag appears in Existing Tags. |
| SETTAG-005 | Color picker | Change color before create. | Preview updates and created tag uses selected color. |
| SETTAG-006 | Tag count | Inspect existing tags. | Each tag shows ticket count from API. |
| SETTAG-007 | Delete tag | Delete an unused test tag and confirm. | Tag disappears from list. |
| SETTAG-008 | Cancel delete tag | Start delete and cancel confirmation. | Tag remains. |
| SETTAG-009 | Create duplicate/invalid | Try duplicate or invalid tag name. | API error is shown to tester. |
| SETTAG-010 | Delete used tag | Try deleting a tag with tickets attached. | Expected behavior is documented by API: either delete succeeds and detaches/archives, or API rejects with clear error. |

## Forms Modal

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| FORM-001 | Open Forms | Settings > Forms. | Forms modal opens. |
| FORM-002 | Placeholder | Inspect modal body. | Shows `Forms management coming soon...`. |
| FORM-003 | Close Forms | Click Close, X, or backdrop. | Modal closes and body scroll unlocks. |

## Analytics

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| ANA-001 | Route load | Open `/analytics`. | Loading skeleton appears, then analytics content renders. |
| ANA-002 | Total consistency | Count all tickets used by analytics. | Totals match dashboard data after same filters. |
| ANA-003 | Team cards | Review Team Performance Details. | Each person shows open, in progress, closed, and total counts. |
| ANA-004 | Unassigned tickets | Include ticket with no assignee. | It appears under `Unassigned`. |
| ANA-005 | Status breakdown | Review status counts and percentages. | Counts match filtered data; `Resolved` is treated as `Closed`. |
| ANA-006 | Unknown status | Include unexpected status if possible. | It is counted as `Open` in analytics. |
| ANA-007 | Priority breakdown | Review active ticket priority counts. | Closed tickets are excluded from priority monitoring. |
| ANA-008 | Department distribution | Review department counts. | Counts match filtered tickets. |
| ANA-009 | Platform distribution | Review platform counts. | Counts match filtered tickets. |
| ANA-010 | Search filters analytics | Use global search on analytics. | Analytics recalculates based on matching tickets. |
| ANA-011 | Status filter analytics | Select status filter. | All analytics sections recalculate. |
| ANA-012 | Priority filter analytics | Select priority filter. | All analytics sections recalculate. |
| ANA-013 | Person filter analytics | Select person filter. | All analytics sections recalculate. |
| ANA-014 | Department filter analytics | Select department filter. | All analytics sections recalculate. |
| ANA-015 | Clear filters | Click Clear Filters. | Analytics returns to full data set. |
| ANA-016 | Refresh | Click Refresh. | Analytics data reloads from API. |
| ANA-017 | Empty result | Apply filters with no matches. | Analytics sections show empty/zero data without crashing. |
| ANA-018 | API failure | Simulate tickets API failure. | Error state displays. |

## Messaging Overlay

Use two separate users in different browsers or one normal browser plus one incognito window.

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| MSG-001 | Overlay bootstrap | Load app with valid cookies. | Messaging overlay initializes; contact lookup succeeds with numeric contact ID. |
| MSG-002 | No stale local session | Clear/reload app after previous login as another user. | Messaging does not use an email-prefix contact ID from stale `localStorage.session`. |
| MSG-003 | WebSocket connect | Open DevTools Network WS. | Connects to `/api/messaging/ws/{numeric_contact_id}` and receives auth/pong messages. |
| MSG-004 | Inbox load | Open messaging. | Inbox loads from `/api/messaging/contacts/{contact_id}/inbox`. |
| MSG-005 | Visible contacts | Start new conversation. | Visible contacts load from `/api/messaging/contacts/{contact_id}/visible-contacts`. |
| MSG-006 | Open thread | Click inbox conversation. | Messages load and display in chronological order. |
| MSG-007 | Send text | Send a text message. | Sender sees message immediately; API POST succeeds; no duplicate blank row. |
| MSG-008 | Receive text live | Recipient stays on inbox list with chat closed while sender sends. | Recipient hears notification sound and inbox row preview/unread count updates without opening the thread. |
| MSG-009 | Receive in open thread | Recipient has the conversation open while sender sends. | Message appears live in thread and is marked read as expected. |
| MSG-010 | Conversation update refresh | Watch WS frames after send. | Client receives both `new_message` and `conversation_updated`; inbox refreshes. |
| MSG-011 | Sender echo | Sender sends while thread open. | Optimistic message merges into saved message; no duplicate after HTTP/WS race. |
| MSG-012 | Unread count | Send to user with chat closed. | Unread count increments; opening/marking read clears count. |
| MSG-013 | Multiple tabs | Open same user in two tabs. | Both sockets receive events; UI remains stable. |
| MSG-014 | Reconnect | Refresh browser or interrupt network briefly. | WebSocket reconnects and inbox can still update. |
| MSG-015 | Message reactions endpoint | Open a conversation with messages. | `/api/messaging/messages/{id}/reactions` returns `200` and either reactions or `[]`; no red 400 spam. |
| MSG-016 | Attachments/media message | Send or receive an image/file if supported by current library. | Preview shows text or `[Image]` correctly; no empty inbox preview. |
| MSG-017 | Group conversation | Create/open group conversation if enabled. | Group appears in inbox; participants receive updates. |
| MSG-018 | New conversation | Start a direct conversation from visible contacts. | Conversation is created or existing conversation opens. |
| MSG-019 | API failure | Temporarily block messaging API. | UI shows safe failure/no crash; reconnect or refresh recovers. |
| MSG-020 | Render logs | After test send, check API logs. | Logs include `broadcast_new_message_ws: delivered to contact_id=...`; no `delivery failed` or `WS send failed`. |

## File Storage API

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| STORE-001 | Upload no files | Submit ticket without attachments. | Ticket create request uses empty attachment array and succeeds. |
| STORE-002 | Upload one file | Submit with one attachment. | `/storage/upload` succeeds before `/tickets`; ticket stores file ID and filename. |
| STORE-003 | Upload multiple files | Submit with multiple attachments. | All uploads complete; ticket stores all file IDs in original order. |
| STORE-004 | Retrieve file | Open modal for ticket with attachment. | `/storage/retrieve` returns base64 data and preview/download works. |
| STORE-005 | Delete API helper | If delete is exposed in UI later, test storage delete. | Deleted file is no longer retrievable. |
| STORE-006 | CORS/network error | Simulate blocked storage API. | Clear error is displayed; app remains usable. |

## Profile Pictures and Avatars

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| AVA-001 | Known user images | Inspect Gustav, Daniel, Michael, Tiaan, Derick, and Ilse. | Configured profile pictures display. |
| AVA-002 | Case-insensitive match | Test a known user with different casing if API allows. | Profile picture still displays. |
| AVA-003 | Unknown user fallback | Inspect unknown or blank user. | Initials or `?` fallback displays with stable color. |
| AVA-004 | Avatar selector | Open assignment selector. | Available people show images or initials. |

## Responsiveness and Browser Compatibility

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| RESP-001 | Desktop Chrome/Edge | Complete smoke tests. | Layout and functionality work. |
| RESP-002 | Desktop Safari/Firefox if available | Complete smoke tests. | Layout and functionality work. |
| RESP-003 | Narrow viewport | Test at mobile/tablet widths. | Header, filters, dashboard, modal, and messaging overlay remain usable. |
| RESP-004 | Long lists | Test with many tickets and groups expanded. | Scrolling is smooth; headers/modals remain usable. |
| RESP-005 | Modal scroll lock | Open/close modals repeatedly. | Body scroll locks only while modal is open and unlocks after close. |

## Accessibility and Usability

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| A11Y-001 | Keyboard navigation | Tab through header controls, form fields, modals, and messaging. | Focus order is usable and visible. |
| A11Y-002 | Enter/Space buttons | Activate buttons with keyboard. | Buttons trigger same actions as mouse. |
| A11Y-003 | Form labels | Inspect New Ticket fields. | Inputs/selects have visible labels and required markers. |
| A11Y-004 | Error messages | Trigger validation errors. | Errors are visible and understandable. |
| A11Y-005 | Color-only status | Review status/priority badges. | Text labels are present, not color-only. |
| A11Y-006 | Image alt text | Inspect avatars/logo/attachment images. | Images have reasonable alt text or decorative behavior. |

## Error and Edge Cases

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| EDGE-001 | Slow API | Throttle network and reload. | Loading states appear; no duplicate requests that break state. |
| EDGE-002 | API 500 list tickets | Force ticket list failure. | Error banner appears; refresh can retry. |
| EDGE-003 | API 500 update ticket | Force update failure. | UI reverts field and shows error. |
| EDGE-004 | Empty domain data | Force one domain endpoint to return empty. | Dropdown fallback/defaults apply where coded or clear empty state appears. |
| EDGE-005 | Missing optional fields | Test ticket with null comments, attachments, tags, previous status, updated_at. | UI displays fallback text and does not crash. |
| EDGE-006 | Special characters | Create ticket/comment/tag with punctuation, quotes, slash, ampersand, and unicode if allowed. | Text saves and renders safely; no HTML injection. |
| EDGE-007 | Large comments | Create ticket with long comment. | Form submits; dashboard truncates; modal shows full content. |
| EDGE-008 | Rapid navigation | Switch Dashboard/Analytics/New quickly during loads. | No stale modal/control state or console errors. |
| EDGE-009 | Session change | Log out/in as another user or switch cookies. | Notifications and messaging use the new user only. |

## Recent Regression Tests

Run these after any messaging or API deployment.

| ID | Area | Steps | Expected Result |
| --- | --- | --- | --- |
| REG-001 | Messaging URLs | Inspect environment and Network tab. | REST and WS messaging URLs include `/api`. |
| REG-002 | Numeric contact ID | Load messaging as each test user. | WS path uses numeric contact ID, not email prefix. |
| REG-003 | WS envelope | Send message and inspect WS frame. | Payload is shaped as `{ type, data }`. |
| REG-004 | JSON-safe payload | Send message with timestamped payload. | API logs show delivery, not serialization failure. |
| REG-005 | Live inbox repaint | Recipient stays on inbox list while sender sends. | Beep, preview, unread count, and row ordering update live. |
| REG-006 | Reactions 400 | Open chat with many messages. | No repeated `GET /messages/{id}/reactions 400` errors. |
| REG-007 | HTTP and NOTIFY duplicate | Send one message. | UI does not show duplicate message rows. |
| REG-008 | Empty preview | Send text message. | Inbox preview shows message text, not blank or `[Image]` unless media-only. |
| REG-009 | Render one worker | Check deploy logs. | API runs with one worker or a cross-instance pub/sub strategy exists. |
| REG-010 | Frontend production config | Build/deploy production app. | Production `apiBaseUrl` and `wsBaseUrl` point to the same messaging API host unless intentionally changed. |

## API Endpoint Checklist Used by App

Testers do not need to call these directly unless debugging, but failures here usually map to the UI tests above.

| Endpoint | Used For |
| --- | --- |
| `GET /api/tickets` | Dashboard and analytics ticket list |
| `GET /api/tickets/{ticket_ref}` | Fresh ticket modal data |
| `POST /api/tickets` | New ticket creation |
| `PATCH /api/tickets/{pk}` | Inline and modal ticket updates |
| `DELETE /api/tickets/{ticket_ref}` | Bulk delete |
| `POST /api/tickets/{pk}/messages` | Service comments |
| `GET /api/domain/departments` | Form/dashboard department dropdowns |
| `GET /api/domain/ticket-types` | Form/dashboard ticket type dropdowns |
| `GET /api/domain/ticket-type-details` | Legacy ticket detail options |
| `GET /api/domain/platforms` | Platform dropdowns |
| `GET /api/domain/ticket-statuses` | Status dropdowns |
| `GET /api/domain/priority-levels` | Priority dropdowns |
| `GET /api/auth/check-admin/{email}` | Admin/non-admin behavior and current user name |
| `GET /api/notifications/unseen-count/{email}` | Notification badge |
| `GET /api/notifications/my-tickets/{email}` | Notification dropdown |
| `POST /api/notifications/mark-seen/{ticket_ref}` | Mark one notification as read |
| `POST /api/notifications/mark-all-seen/{email}` | Mark all notifications as read |
| `GET /api/tags` | Tag modal and tag selectors |
| `POST /api/tags` | Create tag |
| `DELETE /api/tags/{tag_id}` | Delete tag |
| `GET /api/tickets/{ticket_id}/tags` | Ticket modal tag list |
| `POST /api/tickets/{ticket_id}/tags/{tag_id}` | Add tag to ticket |
| `DELETE /api/tickets/{ticket_id}/tags/{tag_id}` | Remove tag from ticket |
| `POST /api/tickets/tags/batch` | Dashboard tag hydration |
| `POST /api/storage/upload` | Attachment upload |
| `POST /api/storage/retrieve` | Attachment preview/download |
| `POST /api/storage/delete` | Storage cleanup if exposed |
| `GET /api/messaging/contacts/by-email/{email}` | Messaging contact resolution |
| `GET /api/messaging/contacts/{contact_id}/inbox` | Messaging inbox |
| `GET /api/messaging/contacts/{contact_id}/visible-contacts` | New/direct conversation contacts |
| `GET /api/messaging/conversations/{conversation_id}/messages` | Message thread load |
| `POST /api/messaging/conversations/{conversation_id}/messages` | Send message |
| `POST /api/messaging/conversations/{conversation_id}/read` | Mark conversation read |
| `GET /api/messaging/messages/{message_id}/reactions` | Message reactions |
| `WebSocket /api/messaging/ws/{contact_id}` | Live messaging events |

## Sign-Off Checklist

Before release, confirm:

- [ ] Smoke tests pass on the target environment.
- [ ] New Ticket flow creates tickets with and without attachments.
- [ ] Dashboard filtering, grouping, sorting, inline editing, and delete mode work.
- [ ] Ticket modal updates, attachments, tags, and service comments work.
- [ ] Notifications badge/dropdown/read states work.
- [ ] Analytics counts match dashboard data under the same filters.
- [ ] Messaging sends, receives, beeps, updates inbox previews, and updates unread counts live.
- [ ] No repeated console errors or failing network requests remain.
- [ ] Known placeholders are accepted by product owner: Forms management and Subtasks.
- [ ] Any failed or skipped cases are logged with ticket refs, users, screenshots, and browser details.
