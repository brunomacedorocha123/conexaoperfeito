// Configuração do Supabase
const SUPABASE_URL = 'https://ivposfgebabrtpexxpko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cG9zZmdlYmFicnRwZXh4cGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1ODczMzEsImV4cCI6MjA3NTE2MzMzMX0.AJU3Vt2dqATDORS4mjTW3gDWeh1MK9lNTWk-uoG5ojo';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase configurado com sucesso!');

// Exportar para usar em outros arquivos
window.supabaseClient = supabase;