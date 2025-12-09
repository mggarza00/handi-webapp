-- Habilita pg_cron (en Supabase local ya está, pero por si acaso)
create extension if not exists pg_cron with schema extensions;

-- Si ya existía, la quitamos sin fallar
select cron.unschedule(jobid)
from cron.job
where jobname = 'handee_weekly_inactivity';

-- Programa: domingos 03:00
select cron.schedule(
  'handee_weekly_inactivity',
  '0 3 * * 0',
  'select public.deactivate_inactive_profiles();'
);
