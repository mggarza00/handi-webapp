begin;

-- Normaliza quotes.image_path removiendo prefijo de bucket si existe
update public.quotes
set image_path = regexp_replace(image_path, '^(chat-attachments|message-attachments)/', '')
where coalesce(image_path, '') ~ '^(chat-attachments|message-attachments)/';

-- Inserta attachments faltantes para cotizaciones con imagen
insert into public.message_attachments (
  message_id,
  conversation_id,
  uploader_id,
  storage_path,
  filename,
  mime_type,
  byte_size,
  width,
  height
)
select
  m.id as message_id,
  q.conversation_id,
  q.professional_id as uploader_id,
  q.image_path as storage_path,
  coalesce(nullif(split_part(q.image_path, '/', array_length(string_to_array(q.image_path, '/'),1)), ''), 'cotizacion.png') as filename,
  'image/png' as mime_type,
  null::bigint as byte_size,
  null::int as width,
  null::int as height
from public.quotes q
join public.messages m
  on m.conversation_id = q.conversation_id
 and m.message_type = 'quote'
 and (m.payload->>'quote_id') = q.id::text
left join public.message_attachments ma
  on ma.message_id = m.id and ma.storage_path = q.image_path
where coalesce(q.image_path,'') <> ''
  and ma.id is null;

commit;

