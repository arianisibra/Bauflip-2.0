export function hasSupabaseAuthCookie(
  cookies: ReadonlyArray<{ name: string }>,
): boolean {
  return cookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}
