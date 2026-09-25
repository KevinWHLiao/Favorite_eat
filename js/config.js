/**
 * Supabase 專案設定（anon / publishable 可公開於前端）
 */
export const SUPABASE_URL = "https://cterospduxvldhgdcnyr.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_7C9mcP4APxJnkhJ6Nfpz8Q_MeuhKlSN";

export function isCloudConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON")
  );
}
