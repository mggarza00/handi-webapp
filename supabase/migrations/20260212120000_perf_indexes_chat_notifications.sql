-- Performance indexes for chat and notifications hot paths

create index if not exists user_notifications_user_id_read_at_idx
  on public.user_notifications (user_id, read_at);

create index if not exists user_notifications_user_id_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

create index if not exists conversations_customer_id_last_message_at_idx
  on public.conversations (customer_id, last_message_at desc);

create index if not exists conversations_pro_id_last_message_at_idx
  on public.conversations (pro_id, last_message_at desc);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at desc);
