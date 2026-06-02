import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://bacoamhbatqpxatrrflz.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhY29hbWhiYXRxcHhhdHJyZmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTgyODgsImV4cCI6MjA4ODY5NDI4OH0.BcFLY1mFlFxCK7E0E89iLlh4am3mEXkbYZaFJ4O_mpw');
const { data: { session } } = await sb.auth.signInWithPassword({ email: process.env.E, password: process.env.P });
console.log('session?', !!session);
