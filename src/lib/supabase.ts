import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type OutreachStatus = 'pending' | 'sent' | 'replied' | 'booked';

export interface OutreachContact {
  id?: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  linkedin_url?: string;
  apollo_id?: string;
  channel?: string;
  status?: OutreachStatus;
  message_sent?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
