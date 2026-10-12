export type PrivacyNotice = { url: string; version: string };

// Server configuration; only this public URL/version may be passed to forms.
// Supplying these values declares that the operator has approved the notice.
export function configuredPrivacyNotice(env: Record<string, string | undefined> = process.env): PrivacyNotice | null {
  const url = env.PRIVACY_NOTICE_URL;
  const version = env.PRIVACY_NOTICE_VERSION;
  if (!url || !version || !/^[a-zA-Z0-9._-]{1,80}$/.test(version)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || url.length > 2048) return null;
    return { url: parsed.href, version };
  } catch { return null; }
}
