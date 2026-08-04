import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://unnoljaucmqygdrzhppn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubm9samF1Y21xeWdkcnpocHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzc4ODUsImV4cCI6MjEwMDcxMzg4NX0.4rvd9_mfvZeIJE6405SUj_Qi4ViT5kV9_9ZmP15n7AM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);