import { NextResponse } from "next/server";
import { getAccount } from "../../../../lib/auth";

export async function GET() {
  const account = await getAccount();

  if (!account) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  return NextResponse.json({ id: account.id, email: account.email, tier: account.tier });
}
