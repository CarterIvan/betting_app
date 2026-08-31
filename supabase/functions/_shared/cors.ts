// Standard CORS headers for Edge Functions invoked from the browser via
// supabase.functions.invoke() — the client sends a preflight OPTIONS
// request first, which every function below must answer.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
