# Messaging App Testing Checklist

Use this checklist to test `@coreline-engineering-solutions/messaging` in a host application. The package may also be referred to internally as `@messaging/messaging-app`.

## Test Scope

This checklist covers:

- Library build and host app integration.
- Authentication/session setup.
- Floating messenger panel behavior.
- Inbox tabs, settings, and responsive layout.
- Direct messages and group chats.
- Group creation, editing, exiting, and removed-member behavior.
- Message input, drafts, replies, mentions, read receipts, and reactions.
- Attachments, clipboard paste, image captions, rich text, code, markdown, and tables.
- Notifications, WebSocket updates, reload behavior, and error handling.

## Test Setup

- Use at least two tester accounts from the same company/connection so they can message each other.
- Use at least three tester accounts for group chat tests.
- Confirm the host app provides `MESSAGING_CONFIG` with valid `apiBaseUrl`, `wsBaseUrl`, and `storageApiUrl`.
- Confirm the host app includes `<app-messaging-overlay></app-messaging-overlay>`.
- Confirm the logged-in user calls `AuthService.setSession(sessionGid, contact)`.
- Build the library with `npm run build:lib`.
- Test in Chrome and one additional browser if possible.
- Test normal sidebar mode and floating/docked-out panel mode.
- Test at multiple panel sizes: narrow, normal, and wide.

## Build And Integration

- [ ] `npm install` completes in `messaging-app`.
- [ ] `npm run build:lib` completes without TypeScript or Angular template errors.
- [ ] The host app can import `MessagingOverlayComponent`.
- [ ] The host app can import `MESSAGING_CONFIG`.
- [ ] The host app can import `AuthService`.
- [ ] The host app starts without dependency injection errors.
- [ ] The overlay appears only after a valid messaging session is set.
- [ ] Logging out or clearing the session removes/clears messaging state.

## Exported Public API

Confirm these exports can be imported by a host app where needed:

- [ ] `MessagingOverlayComponent`
- [ ] `FloatingButtonComponent`
- [ ] `ChatPanelComponent`
- [ ] `InboxListComponent`
- [ ] `ChatThreadComponent`
- [ ] `NewConversationComponent`
- [ ] `GroupManagerComponent`
- [ ] `MessageInputComponent`
- [ ] `AuthService`
- [ ] `MessagingStoreService`
- [ ] `MessagingApiService`
- [ ] `MessagingWebSocketService`
- [ ] `MessagingFileService`
- [ ] Models such as `Contact`, `Message`, `InboxItem`, `Conversation`, `Attachment`, and `MessageReaction`

## Authentication And Contacts

- [ ] User session initializes with `session_gid`.
- [ ] User contact is mapped to the backend contact id.
- [ ] Visible contacts load successfully.
- [ ] Direct-message contact names display correctly.
- [ ] The current user's own display name is not shown as literal `You` in group system messages.
- [ ] Missing or invalid session does not crash the UI.
- [ ] Contact ids that arrive as numbers or strings behave consistently.

## Floating Button And Panel

- [ ] Floating messaging button opens the messenger.
- [ ] Floating messaging button closes the messenger when it is open.
- [ ] Panel close button closes the messenger.
- [ ] Close button works when the messenger is docked in the sidebar.
- [ ] Close button works when the messenger is floating/docked out.
- [ ] Floating button can be dragged without opening accidentally.
- [ ] If the panel was open before dragging, it reopens correctly after drag.
- [ ] Panel position remains usable after dragging.
- [ ] Panel resize works.
- [ ] Narrow panel layout remains readable.
- [ ] Wide panel layout remains readable.

## Inbox

- [ ] Inbox loads conversations for the logged-in contact.
- [ ] Inbox rows show conversation name, preview, time, and unread count.
- [ ] Search filters conversations by name.
- [ ] Search filters conversations by last message preview.
- [ ] Empty inbox state displays correctly.
- [ ] Unread count increments for incoming messages in inactive chats.
- [ ] Opening a conversation clears unread count.
- [ ] Inbox updates when WebSocket `conversation_updated` events arrive.
- [ ] Inbox updates when polling refreshes data.
- [ ] Conversation preview updates after sending a message.
- [ ] Conversation preview updates after receiving a message.

## Inbox Tabs

- [ ] `All` tab shows direct chats and groups.
- [ ] `Chats` tab shows only direct conversations.
- [ ] `Groups` tab shows only group conversations.
- [ ] `Projects` tab shows a coming-soon state.
- [ ] `Settings` tab shows settings controls.
- [ ] Active tab persists after closing/reopening the messenger.
- [ ] Active tab persists after deleting/exiting a group.
- [ ] Icon tabs show tooltips on hover.
- [ ] Tabs remain usable when the panel is narrow.

## Settings

- [ ] Mute notifications can be toggled on.
- [ ] Mute notifications can be toggled off.
- [ ] Mute setting persists after reload.
- [ ] Notification volume slider changes sound loudness.
- [ ] Volume setting persists after reload.
- [ ] Test/preview sound respects mute and volume.
- [ ] Message size slider changes normal message text size.
- [ ] Programming size slider changes code/table/preformatted text size.
- [ ] Message size setting persists after reload.
- [ ] Programming size setting persists after reload.
- [ ] Live previews update while sliders move.

## Direct Messages

- [ ] Start a new direct conversation from a contact.
- [ ] Send a plain text message.
- [ ] Receive a plain text message from another user.
- [ ] Sender sees the message as own bubble.
- [ ] Recipient sees the message as other bubble.
- [ ] Message timestamps display correctly.
- [ ] Sent messages appear immediately without needing a manual refresh.
- [ ] Incoming WebSocket messages appear without needing a manual refresh.
- [ ] Reloading the page keeps previously sent messages visible.
- [ ] Empty direct chat shows the empty-chat state.

## Group Creation

- [ ] Create a group with a name and selected contacts.
- [ ] Create button disables or shows progress while creating.
- [ ] Repeated clicks do not create duplicate groups.
- [ ] Newly created group opens directly into the group chat.
- [ ] Group appears in the inbox.
- [ ] Group appears under the `Groups` tab.
- [ ] Creator is included as a member.
- [ ] Selected members are included as members.
- [ ] Group creation failure keeps the user on the creation UI.
- [ ] Group creation failure allows retry.

## Group Settings And Membership

- [ ] Group settings icon is visually centered.
- [ ] Group settings opens for a group chat.
- [ ] Existing members display in settings.
- [ ] Add one member to a group.
- [ ] Add multiple members to a group.
- [ ] Added member appears in the member list.
- [ ] Added member can immediately be mentioned with `@` without reload.
- [ ] System message appears when a member is added.
- [ ] System message text uses actual usernames/display names.
- [ ] System message does not look like a normal chat bubble.
- [ ] Remove a member from a group.
- [ ] Removed member disappears from the member list.
- [ ] System message appears when a member is removed.
- [ ] Removing a member handles backend errors without corrupting UI state.
- [ ] Rename group if rename is supported in the UI.
- [ ] Renamed group updates in chat header and inbox.

## Exit Group

- [ ] Group action is labeled `Exit Group`, not `Delete Group`.
- [ ] Exit group button opens an in-panel confirmation modal.
- [ ] Cancel closes the confirmation modal and keeps the group.
- [ ] Confirm exits/removes the group from current user's inbox.
- [ ] UI updates optimistically while exiting.
- [ ] Toast confirms group exit/removal.
- [ ] If exit fails, user remains in group settings.
- [ ] If exit fails, group remains visible.
- [ ] Exiting a group does not delete the group for other users.

## Removed From Group State

- [ ] Removed user receives a message/state indicating they were removed.
- [ ] Removed user cannot send messages in that group.
- [ ] Removed user cannot attach files in that group.
- [ ] Removed user cannot open group settings.
- [ ] Removed user sees an `Exit Group` button.
- [ ] Clicking `Exit Group` removes the group locally without confirmation.
- [ ] Removed group does not reappear after inbox refresh.

## Message Input

- [ ] Typing text enables the send button.
- [ ] Empty input with no files disables the send button.
- [ ] Pressing Enter sends a message.
- [ ] Pressing Shift+Enter inserts a new line.
- [ ] Textarea auto-grows after the first line.
- [ ] Textarea keeps growing until the maximum height.
- [ ] Textarea scrolls only after reaching the maximum height.
- [ ] Dragging the top border upward manually expands the input.
- [ ] Dragging the top border downward shrinks the input.
- [ ] Draft text persists after leaving a conversation.
- [ ] Draft text restores when returning to the conversation.
- [ ] Draft clears after sending.
- [ ] Drafts are separate per conversation.

## Replies

- [ ] In group chats, hover a message and see the reply icon at bottom right.
- [ ] Clicking reply shows a reply preview above the input.
- [ ] Reply preview shows original sender and message excerpt.
- [ ] Cancel reply removes the reply preview.
- [ ] Sending a reply shows a quoted block inside the new message.
- [ ] Reply block appears above the response text.
- [ ] Reply survives page reload.
- [ ] Reply with attachment message uses an appropriate fallback preview.
- [ ] Reply with code/markdown/table response still renders correctly.
- [ ] Direct chats do not show group-only reply behavior unless intentionally enabled.

## Mentions

- [ ] In a group chat, typing `@` opens mention suggestions.
- [ ] Mention suggestions show group members.
- [ ] Suggestions filter as the user types.
- [ ] Clicking a suggestion inserts the mention token.
- [ ] Pressing Enter while suggestions are open selects the top suggestion.
- [ ] Pressing Escape closes suggestions.
- [ ] Current user is not suggested for self-mention.
- [ ] Newly added group members are mentionable immediately.
- [ ] Sending a mention notifies/flags the mentioned user.
- [ ] Mentioned user sees an `@` badge in the inbox when the message is unread.
- [ ] Opening the conversation clears the `@` badge.
- [ ] Normal text with an `@` mention does not become a code block.
- [ ] Example should stay normal text: `@IlseJansevanRensburg let me know if you can see all`

## Read Receipts

- [ ] Own sent messages show a single sent tick before read.
- [ ] Own read messages show differentiated double/read ticks.
- [ ] Tooltip for unread/sent state says `Sent`.
- [ ] Tooltip for read state says `Read` or appropriate group read info.
- [ ] Tick colors/opacity differ between sent and read.
- [ ] Read state updates after the recipient opens the chat.
- [ ] Read state remains correct after reload.

## Reactions

- [ ] Hovering a message shows quick reactions.
- [ ] Selecting a quick reaction adds it to the message.
- [ ] Reaction count displays.
- [ ] Reactor names appear in tooltip.
- [ ] Clicking your own reaction again removes it.
- [ ] Reaction UI does not flicker on hover.
- [ ] Reactions persist after reload.
- [ ] Reactions update for both sender and recipient.
- [ ] Reaction rollback works if the API call fails.

## Text Rendering

- [ ] Plain single-line text renders as normal text.
- [ ] Plain multi-line text preserves line breaks.
- [ ] Preformatted text preserves spacing.
- [ ] Long text wraps inside the bubble.
- [ ] Long rendered blocks remain within the panel width.
- [ ] Hidden scrollbars still allow scrolling.
- [ ] Resizing the panel makes messages and rich blocks adapt.
- [ ] Normal text size setting affects regular messages.
- [ ] Programming size setting affects preformatted/code content.

## Code Detection And Rendering

- [ ] SQL code is detected and labeled `sql`.
- [ ] JavaScript code is detected and labeled `javascript`.
- [ ] Python code is detected and labeled `python`.
- [ ] HTML code is detected and labeled `html`.
- [ ] Code renders with syntax highlighting.
- [ ] Code block has a copy button.
- [ ] Copy button copies the original code text.
- [ ] Long code blocks scroll horizontally without showing visible scrollbars.
- [ ] Composer shows a detected-language chip before sending code-like drafts.
- [ ] Closing the detected-language chip sends/reloads that message as normal text.
- [ ] Accidental long normal prose does not become code unless code triggers are strong enough.
- [ ] `let me know` in normal text does not trigger JavaScript.

Use these examples:

```sql
SELECT ticket_ref, status, created_at
FROM logging.ticket
WHERE status = 'Open'
ORDER BY created_at DESC;
```

```javascript
const total = items.reduce((sum, item) => sum + item.amount, 0);
console.log(total);
```

```python
def format_ticket(ticket):
    if ticket["status"] == "Open":
        print(f"Ticket {ticket['ticket_ref']} needs attention")
    return ticket["status"]
```

```html
<section class="ticket-card">
  <h2>Open Ticket</h2>
  <p>Status: Open</p>
</section>
```

## Markdown Rendering

- [ ] Markdown headings render as headings.
- [ ] Bold text renders correctly.
- [ ] Italic text renders correctly.
- [ ] Inline code renders correctly.
- [ ] Links render correctly and open safely.
- [ ] Lists render correctly.
- [ ] Quotes render correctly.
- [ ] Markdown messages show the `md` label.
- [ ] Markdown block has a copy button.
- [ ] Markdown does not incorrectly render as code.

Use this example:

```markdown
# Release Notes

**Status:** Ready

- Added group replies
- Added @mentions
- Added code detection

> Please test reload behavior.
```

## Tables And Excel Paste

- [ ] Pasting an HTML table keeps table-like structure.
- [ ] Pasting cells from Excel renders as table blocks.
- [ ] Table headers display distinctly.
- [ ] Table cells align correctly.
- [ ] Table block scrolls horizontally when needed.
- [ ] Table block has a copy button.
- [ ] Copied table text preserves tab-separated values.

Use this tab-separated example:

```text
Ticket	Status	Owner
1001	Open	Ilse
1002	Closed	Daniel
1003	In Progress	Support
```

## Attachments

- [ ] Attach one file.
- [ ] Attach multiple files.
- [ ] Remove a selected file before sending.
- [ ] Send a file-only message.
- [ ] Send text with a file.
- [ ] Recipient sees file and text.
- [ ] Files survive reload.
- [ ] File names display correctly.
- [ ] File size displays in preview before sending.
- [ ] Download button downloads the file.
- [ ] Upload failure does not leave a broken permanent message.
- [ ] Temp file ids are never sent to the backend.

## Images And Clipboard Paste

- [ ] Attach an image file.
- [ ] Paste a screenshot from clipboard.
- [ ] Pasted screenshot appears as an attachment preview.
- [ ] Send image-only message.
- [ ] Send image with text caption.
- [ ] Recipient sees image and caption.
- [ ] Caption appears below the image.
- [ ] Caption width matches image width.
- [ ] Long caption wraps without making image layout awkward.
- [ ] Image opens in lightbox/open view.
- [ ] Image can be downloaded.
- [ ] Image and caption survive page reload.
- [ ] Image still renders after reload when backend returns only a file id.
- [ ] Image captions containing code render as code unless composer chip was dismissed.
- [ ] Image captions containing markdown render as markdown.

## Notifications

- [ ] Incoming message plays notification sound when unmuted.
- [ ] Muted notifications do not play sound.
- [ ] Volume slider affects notification loudness.
- [ ] Notification settings persist after reload.
- [ ] Own messages do not play incoming notification sound.
- [ ] Mentioned unread group messages show the `@` badge.

## WebSocket And Realtime

- [ ] WebSocket connects after session initialization.
- [ ] WebSocket subscribes to inbox conversations.
- [ ] Incoming direct message appears without refresh.
- [ ] Incoming group message appears without refresh.
- [ ] Group updates refresh inbox/group state.
- [ ] Reactions update without manual refresh where supported.
- [ ] If WebSocket is interrupted, polling still refreshes inbox eventually.
- [ ] Duplicate messages do not appear when HTTP response and WebSocket event both arrive.
- [ ] Own optimistic messages are replaced/merged with real backend ids.

## Reload And Persistence

- [ ] Reload preserves inbox state from backend.
- [ ] Reload preserves direct messages.
- [ ] Reload preserves group messages.
- [ ] Reload preserves replies.
- [ ] Reload preserves mentions in message text.
- [ ] Reload preserves unread counts.
- [ ] Reload preserves `@` mention badge until conversation is read.
- [ ] Reload preserves attachments.
- [ ] Reload preserves image captions.
- [ ] Reload preserves rich text rendering.
- [ ] Reload respects plain-text override from dismissed code chip.
- [ ] Settings persist through reload.
- [ ] Drafts persist through view changes and reload where local storage is available.

## Responsive And Accessibility

- [ ] Panel works at narrow width.
- [ ] Panel works at normal width.
- [ ] Panel works at wide width.
- [ ] Header title scales and hides gracefully at very narrow widths.
- [ ] Inbox tabs fit in available space.
- [ ] Message bubbles stay inside the panel.
- [ ] Code/table/markdown blocks stay inside the panel.
- [ ] Message size controls improve readability.
- [ ] Programming size controls improve readability.
- [ ] Tooltips appear for icon-only controls.
- [ ] Buttons have clear hover/focus states.
- [ ] Keyboard sending works.
- [ ] Keyboard mention selection works.

## Error And Edge Cases

- [ ] Backend message send failure does not crash the UI.
- [ ] File upload failure does not crash the UI.
- [ ] Group creation failure allows retry.
- [ ] Group exit failure rolls UI back.
- [ ] Remove member failure rolls UI back or keeps consistent state.
- [ ] Empty API responses do not crash message rendering.
- [ ] Unknown sender falls back to a safe display name.
- [ ] Missing file metadata still renders images/files when possible.
- [ ] Invalid media URL does not leave an infinite spinner.
- [ ] Very long usernames do not break layout.
- [ ] Very long message text does not break layout.
- [ ] Special characters in messages display safely.
- [ ] Literal `@` signs in Angular templates render correctly.

## Service-Level Functional Checks

These can be verified through UI behavior, dev tools, or targeted integration tests.

### `AuthService`

- [ ] `setSession` stores the current contact/session.
- [ ] Authenticated state becomes true after session setup.
- [ ] `contactId`, `sessionGid`, and `currentContact` are available to messaging services.
- [ ] Clearing/teardown removes session-dependent messaging state.

### `MessagingStoreService`

- [ ] `initialize` loads inbox and visible contacts.
- [ ] `loadInbox` normalizes group/direct inbox rows.
- [ ] `loadMessages` loads and normalizes message shapes.
- [ ] `sendMessage` creates optimistic message and replaces it with backend response.
- [ ] `openConversation` opens chat view, loads messages once, marks read, and subscribes to WebSocket.
- [ ] `markAsRead` clears unread and mention indicators.
- [ ] `createGroupConversation` opens the newly created group.
- [ ] `manageGroup` handles add/remove/rename flows.
- [ ] `deleteGroup` behaves as exit group for current user.
- [ ] `appendOptimisticMessage` avoids duplicates.
- [ ] Attachment normalization handles `attachments`, `attachment_ids`, `file_ids`, `media_url`, and JSON media payloads.
- [ ] Reply normalization converts stored reply quote text into UI reply preview.
- [ ] Plain-text override normalization strips internal marker before display.
- [ ] Notification volume/mute settings persist.
- [ ] Message/code text scale settings persist.

### `MessagingApiService`

- [ ] `getInbox` calls the correct inbox endpoint.
- [ ] `getMessages` includes contact id and pagination params.
- [ ] `sendMessage` sends content and sender id.
- [ ] `sendDirectMessage` sends recipient and sender ids.
- [ ] `markConversationRead` sends contact id.
- [ ] `createConversation` sends creator and participants.
- [ ] `getConversationParticipants` returns group members.
- [ ] `manageGroup` sends create/add/remove/rename payloads correctly.
- [ ] `deleteGroup` maps to group remove/exit behavior.
- [ ] `addReaction`, `removeReaction`, and `getReactions` work.
- [ ] Search/presence/thread endpoints do not break existing exports.

### `MessagingWebSocketService`

- [ ] `connect` opens with contact/session data.
- [ ] `disconnect` closes the socket.
- [ ] `subscribe` subscribes to a conversation.
- [ ] `subscribeAll` subscribes to inbox conversations.
- [ ] `new_message` events are processed.
- [ ] `conversation_updated` events trigger inbox refresh.
- [ ] `group_updated` events trigger group/inbox refresh.
- [ ] Error messages do not crash the UI.

### `MessagingFileService`

- [ ] `uploadFile` sends `FormData` with file and category.
- [ ] `uploadFiles` uploads multiple files sequentially.
- [ ] `sendMessageWithAttachments` sends content, real file ids, filenames, and MIME types.
- [ ] Temp ids are filtered out before sending.
- [ ] `getFileDataUrl` retrieves and caches file data.
- [ ] `prewarmCache` improves immediate image rendering.
- [ ] Delete/download fallback endpoints behave as expected.

## Regression Test Examples

Run these after each release candidate:

- [ ] Send normal mention text: `@IlseJansevanRensburg let me know if you can see all`
- [ ] Send JavaScript code and confirm language chip appears.
- [ ] Close JavaScript language chip and confirm message sends as normal text.
- [ ] Reload and confirm the dismissed-chip message still appears as normal text.
- [ ] Add a new group member and immediately mention them without reload.
- [ ] Send image plus caption and reload.
- [ ] Send reply to a group message and reload.
- [ ] Paste Excel cells and confirm table rendering.
- [ ] Change notification volume and test sound.
- [ ] Exit a group and confirm other members still have the group.

## Tester Evidence To Capture

For each failed test, capture:

- Tester account used.
- Browser and version.
- Conversation or group name.
- Exact action steps.
- Expected result.
- Actual result.
- Screenshot or screen recording.
- Console errors, if any.
- Network request/response details, if relevant.
- Whether the issue persists after reload.
