export function profilePossessiveTitle(profileName: string) {
  const trimmed = profileName.trim();
  if (!trimmed) {
    return "Profile";
  }

  if (/s$/i.test(trimmed)) {
    return `${trimmed}' profile`;
  }

  return `${trimmed}'s profile`;
}
