// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Get environment variables (set these in .env.local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
