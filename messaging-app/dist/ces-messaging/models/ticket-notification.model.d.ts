export interface TicketNotificationItem {
    ticket_ref: string;
    department?: string;
    type?: string;
    type_detail?: string;
    user_requested?: string;
    ticket_status: string;
    person_responsible?: string;
    priority_level?: string;
    created_at?: string;
    is_seen: boolean;
}
