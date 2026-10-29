// js/supabase-config.js
const SUPABASE_URL = 'https://fmhdrcpnaydvvaiwexni.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaGRyY3BuYXlkdnZhaXdleG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NTYzMzIsImV4cCI6MjEwODEzMjMzMn0.0F23xR3NfKHkXMGkx4F1bdFXXuroRHD8-rQ7YMHc-lU';

// Inisialisasi Supabase Client Global
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
