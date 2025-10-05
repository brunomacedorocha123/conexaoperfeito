// supabase.js - Configuração para Conexão Perfeita Amor
const SUPABASE_URL = 'https://ifjakhtwtekzfzpsvhld.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmamFraHR3dGVremZ6cHN2aGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MDk4NzEsImV4cCI6MjA3NDk4NTg3MX0.-2SA8MX7Lr7DjrMc_cBM9KfN1Bwo8ibU3GNks2x3Alc';

// Criar cliente Supabase
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

console.log('✅ Supabase configurado - Conexão Perfeita Amor');