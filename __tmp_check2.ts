import type { Database } from './types/supabase';
type Keys = keyof Database['public']['Tables'];
const key: Keys = 'user_addresses';

