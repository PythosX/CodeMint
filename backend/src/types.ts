export interface Env {
  SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string;
  GITHUB_TOKEN?: string; PAGESPEED_API_KEY?: string; AI_API_KEY?: string; AI_MODEL?: string; FRONTEND_URL?: string;
}
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface Finding {
  category: 'performance' | 'security' | 'seo' | 'accessibility' | 'website' | 'code_quality' | 'testing' | 'dependencies' | 'missing_feature' | 'architecture';
  title: string; description: string; severity: Severity; confidence: 'high' | 'medium' | 'low';
  evidence: string; affected_resource?: string; suggested_fix: string;
}
export interface EngineResult { findings: Finding[]; facts: Record<string, unknown>; checks: string[]; error?: string }
export type Progress = (stage: string, pct: number) => Promise<void>;
