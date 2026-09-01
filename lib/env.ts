export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || !secret.trim()) {
    throw new Error("Missing required environment variable: AUTH_SECRET");
  }

  return secret;
}

export function assertAuthConfigured() {
  getAuthSecret();
}

export function getAuthUrl(): string | undefined {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
}
