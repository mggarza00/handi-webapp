-- Add per-user email chat notifications preference to profiles
alter table if exists public.profiles
  add column if not exists email_chat_notifications_enabled boolean not null default true;

comment on column public.profiles.email_chat_notifications_enabled is 'Whether the user wants to receive email notifications for chat messages. Default true.';

