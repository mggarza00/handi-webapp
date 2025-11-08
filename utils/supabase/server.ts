// utils/supabase/server.ts — deprecated shim
// deprecated: usa '/lib/supabase/server-client' o '/lib/supabase/route-client' directamente
export { default } from "@/lib/supabase/server-client";
export { default as getServerClient } from "@/lib/supabase/server-client";
export { default as getRouteClient } from "@/lib/supabase/route-client";
