### Schema and table reference

| Item                   | Schema / Table                      | Notes                                                       |
|------------------------|-------------------------------------|-------------------------------------------------------------|
| Schema                 | `messaging`                         | Main namespace for all messaging objects                    |
| Source Table           | `admin.users`                       | Used by the contact sync trigger                            |
| Contacts               | `messaging.contact`                 | Stores user/contact profiles                                |
| Conversations          | `messaging.conversation`            | Stores chat threads                                         |
| Participants           | `messaging.conversation_participant`| Tracks members and their join/leave activity                |
| Messages               | `messaging.message`                 | Stores messages                                             |
| Read Receipts          | `messaging.message_read`            | Tracks which messages have been read                        |
| Company Connections    | `messaging.company_connection`      | Stores company-to-company connection requests               |


### Function Reference

| Function (messaging.funcition)              | Description                                                                                                                      |
|-------------------------------------------- |----------------------------------------------------------------------------------------------------------------------------------|
| `fn_sync_user_to_contact`                   | When a user is added the basic contact is created and there is a trigger to add it from the admin.users table
| `fn_assert_contact_exists_and_active`       | Validates that a contact exists and is active before it can participate in conversation, send, or inbox operations.
| `fn_assert_active_participant`              | Ensures the contact is both active and currently part of the conversation.
| `fn_get_direct_conversation_id`             | Looks up an existing one-to-one conversation between two contacts.
| `fn_create_conversation`                    | Creates a new group conversation and adds the creator plus all recipients.
| `fn_send_message`                           | Sends a message into an existing conversation after validating membership.
| `fn_send_direct_message`                    | Finds or creates a direct conversation before sending the first message.
| `fn_mark_conversation_read`                 | Marks every unread message in a conversation as read for one contact.
| `fn_get_conversation_messages`              | Returns the full message history for one conversation, including read state.
| `fn_get_contact_inbox`                      | Returns the inbox view for a contact, including latest message and unread counts.
| `fn_assert_company_admin`                   | Validates that a contact belongs to a company and holds admin privileges
| `fn_get_contact_company`                    | Returns the company for an active contact. Raises if not found or no company
| `fn_assert_companies_connected`             | Checks that two companies have an active connection or are the same company
| `fn_assert_all_participants_connected`      | Validates every unique pair of companies among the given contacts can collaborate. Used to enforce group conversation rules.
| `fn_assert_sender_connected_to_conversation`| Checks that a sender's company is connected to every other company.Prevents new messages after revocation
| `fn_send_connection_invite`                 | Sends a connection invite from one company to another. Only a company admin can initiate.
| `fn_respond_to_connection`                  | Responds to a pending connection invite. Only the responder company's admin can accept or reject.
| `fn_revoke_connection`                      | Revokes an active connection. After revocation, new messages and conversations are blocked historical data remains readable
| `fn_get_allowed_companies`                  | Returns all companies that have an active connection with the given company
| `fn_get_visible_contacts`                   | Returns contacts visible to a given contact: same company plus connected companies.
| `fn_get_company_connections`                | Returns all connection records for a company admin's dashboard
| `fn_missing_contact_info_json`              | Checks for missing details and allows it to be updated. returns json false for missing fields
| `fn_manage_group`                           | Handles the following features for Group Management: Create a group,Add Participants,Remove Participants,Rename Group


# Frontend Work

## Task: Management Setup

| Task  | Description                                           | Backend Function                                                                                                       |
|-------|-------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| 1.1   | Invite Company UI                                     | Frontend only, validated by fn_send_connection_invite                                                                  |
| 1.2   | List connected companies                              | fn_get_allowed_companies(company) → returns active connections                                                         |
| 1.3   | Outgoing requests                                     | fn_get_company_connections(admin_contact_id) → filter where requester_company = your_company AND status = 'PENDING'    |
| 1.4   | Incoming requests                                     | fn_get_company_connections(admin_contact_id) → filter where responder_company = your_company AND status = 'PENDING'    |
| 1.5   | Send invites                                          | fn_send_connection_invite(admin_contact_id, target_company)                                                            |
| 1.6   | Accept/reject                                         | fn_respond_to_connection(admin_contact_id, connection_id, accept)                                                      |
| 1.7   | Revoke connections                                    | fn_revoke_connection(admin_contact_id, connection_id)                                                                  |
| 1.8   | Connection status                                     | fn_get_company_connections returns status field (PENDING, ACTIVE, REJECTED, REVOKED)                                   |
| 1.9   | Non-admin prevention                                  | fn_assert_company_admin is called by all admin functions; raises exception if not admin                                |
| 1.10  | Filter visible contacts                               | fn_get_visible_contacts(contact_id) → backend already filters by allowed companies                                     |
| 1.11  | Prevent restricted contact selection                  | Use fn_get_visible_contacts as your allowed list; anyone not in that result is restricted                              |
| 1.12  | Prevent restricted group members                      | fn_create_conversation calls fn_assert_all_participants_connected → raises if any participant from unconnected company |
| 1.13  | Notifications                                         | Frontend/WebSocket only (no backend function)                                                                          |
| 1.14  | Error handling                                        | All functions raise descriptive exceptions (duplicate invite = 409, invalid company = 404, not authorized = 403)       |


## Task: Messaging Setup

| Task   | Description                                           | Notes / Backend Function                                                   |
|--------|-------------------------------------------------------|----------------------------------------------------------------------------|
| 2.1    | Conversation list UI                                  | fn_get_contact_inbox                                                       |
| 2.2    | Conversation search and filter                        | fn_get_contact_inbox                                                       |
| 2.3    | Chat thread view                                      | fn_get_conversation_messages                                               |
| 2.4    | Message input box                                     | fn_send_message / fn_send_direct_message                                   |
| 2.5    | Send button                                           | fn_send_message / fn_send_direct_message                                   |
| 2.6    | Group creation UI                                     | fn_create_conversation                                                     |
| 2.7    | Add/remove participants                               | fn_manage_group                                                            |
| 2.8    | Read receipts                                         | fn_mark_conversation_read                                                  |
| 2.9    | Message formatting                                    | fn_send_message                                                            |
| 2.10   | Scroll and pagination                                 | fn_get_conversation_messages                                               |
| 2.11   | Typing indicators                                     | Optional: WebSocket / frontend only                                        |
| 2.12   | Notifications                                         | Optional: WebSocket / frontend only                                        |
| 2.13   | Error handling                                        | All backend exceptions handled gracefully                                  |
| 2.14   | Responsive design                                     | Frontend only                                                              |
| 2.15   | Styling & themes                                      | Frontend only                                                              |


## Task: New Message User Contact Setup

| Task  | Description                                           | Notes / Backend Function                                  |
|-------|-------------------------------------------------------|-----------------------------------------------------------|
| 3.1   | Pre-send Contact Info Check                           | fn_missing_contact_info_json                              |
| 3.2   | Contact Info Form                                     | fn_missing_contact_info_json                              |
| 3.3   | Messaging System Access                               | fn_send_message / fn_send_direct_message                  |

# API Setup

See API integration MD for full request/response examples.

---

## Task: Connection Management Endpoints

| Task  | Description                                | Method | Endpoint                                   |
|-------|--------------------------------------------|--------|--------------------------------------------|
| 4.1   | Send connection invite                     | POST   | `/api/connections/invites`                 |
| 4.2   | Respond to connection invite               | POST   | `/api/connections/{connection_id}/respond` |
| 4.3   | Revoke active connection                   | POST   | `/api/connections/{connection_id}/revoke`  |
| 4.4   | List company connections (admin dashboard) | GET    | `/api/contacts/{contact_id}/connections`   |
| 4.5   | List allowed companies                     | GET    | `/api/companies/{company}/allowed`         |

---

## Task: Contact Endpoints

| Task  | Description                                | Method | Endpoint                                      |
|-------|--------------------------------------------|--------|-----------------------------------------------|
| 5.1   | Get visible contacts                       | GET    | `/api/contacts/{contact_id}/visible-contacts` |
| 5.2   | Check/update missing contact fields        | POST   | `/api/contacts/check`                         |

---

## Task: Conversation Endpoints

| Task  | Description                                   | Method | Endpoint                                        |
|-------|-----------------------------------------------|--------|-------------------------------------------------|
| 6.1   | Create conversation (direct or group)         | POST   | `/api/conversations`                            |
| 6.2   | Look up direct conversation                   | GET    | `/api/conversations/direct?contactA=&contactB=` |
| 6.3   | Get inbox (all conversations + unread counts) | GET    | `/api/contacts/{contact_id}/inbox`              |

---

## Task: Message Endpoints

| Task  | Description                                | Method | Endpoint                                                                           |
|-------|--------------------------------------------|--------|------------------------------------------------------------------------------------|
| 7.1   | Send message to conversation               | POST   | `/api/conversations/{conversation_id}/messages`                                    |
| 7.2   | Send direct message                        | POST   | `/api/direct-messages`                                                             |
| 7.3   | Get conversation messages (paginated)      | GET    | `/api/conversations/{conversation_id}/messages?contactId=&beforeMessageId=&limit=` |
| 7.4   | Mark conversation as read                  | POST   | `/api/conversations/{conversation_id}/read`                                        |

---

## Task: Group Management Endpoints

| Task  | Description                                | Method | Endpoint                               |
|-------|--------------------------------------------|--------|----------------------------------------|
| 8.1   | Create group                               | POST   | `/api/groups` (action: create)         |
| 8.2   | Add participant to group                   | POST   | `/api/groups` (action: add)            |
| 8.3   | Remove participant from group              | POST   | `/api/groups` (action: remove)         |
| 8.4   | Rename group                               | POST   | `/api/groups` (action: rename)         |

---

## Task: Health & Infrastructure

| Task  | Description                                | Method | Endpoint                  |
|-------|--------------------------------------------|--------|---------------------------|
| 9.1   | Health check                               | GET    | `/health`                 |
| 9.2   | Error handling middleware                  | —      | All endpoints             |
| 9.3   | CORS configuration                         | —      | All endpoints             |