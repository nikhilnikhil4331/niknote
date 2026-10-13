type AccountIdentity = { user_metadata?: Record<string, unknown> } | null | undefined;

export function accountName(user: AccountIdentity) {
  const metadata = user?.user_metadata;
  const name = [metadata?.full_name, metadata?.name, metadata?.display_name]
    .find(value => typeof value === 'string' && value.trim().length > 0);
  const fullName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : user ? 'Your account' : 'Guest';
  return { fullName, firstName: typeof name === 'string' ? fullName.split(' ')[0] : '' };
}