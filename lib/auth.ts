import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "eps_account_session";
export const SESSION_DURATION_DAYS = 30;

// Returns the logged-in account or null
export async function getAccount(): Promise<{ id: string; email: string; tier: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const authToken = await prisma.authToken.findUnique({
    where: { token },
    include: { account: true },
  });
  if (!authToken || authToken.used) return null;
  if (authToken.expiresAt < new Date()) return null;
  return authToken.account;
}

// Generates a secure random token
export function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 48; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}
