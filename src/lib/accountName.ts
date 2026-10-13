type AccountIdentity = { user_metadata?: Record<string, unknown> | null; email?: string } | null | undefined;

export function accountName(user: AccountIdentity, profileName?: string | null) {
  const metadata = user?.user_metadata;
  const name = [profileName, metadata?.full_name, metadata?.name, metadata?.display_name, user?.email?.split('@')[0]]
    .find(value => typeof value === 'string' && value.trim().length > 0);
  const fullName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : user ? 'Your account' : 'Guest';
  return { fullName, firstName: typeof name === 'string' ? fullName.split(' ')[0] : '' };
}