/**
 * 把下面兩行換成你的 Supabase 專案設定：
 * Project Settings → API → Project URL / anon public key
 *
 * 免費申請：https://supabase.com
 */
export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

export function isCloudConfigured() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_PROJECT") &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON")
  );
}
