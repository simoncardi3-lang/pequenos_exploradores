// ============================================================================
// CONFIGURACIÓN DE SUPABASE — SITIO GENERAL
// ============================================================================

export const SUPABASE_URL = 'https://rtddhrnwkmvbvbrpyjzu.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_pKPVU3j3bAdJIal6fRjAjw_rZ8atxVM';

export function isSupabaseConfigured() {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('tu-proyecto') &&
    !SUPABASE_ANON_KEY.includes('tu-clave')
  );
}