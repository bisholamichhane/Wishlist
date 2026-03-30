import { createHmac, randomBytes } from "crypto";
import { getShopWidgetSecret } from "../supabase.server";

export function generateNewWidgetSecret(): string {
  return randomBytes(32).toString("hex");
}

export function signWidgetToken(shopDomain: string, secret: string): string {
  return createHmac("sha256", secret).update(shopDomain).digest("hex");
}

export async function verifyWidgetToken(
  shopDomain: string,
  token: string
): Promise<boolean> {
  console.log("[verifyWidgetToken] shop:", shopDomain);
  console.log("[verifyWidgetToken] incoming token:", token);
  console.log("[verifyWidgetToken] incoming token length:", token?.length);

  const secret = await getShopWidgetSecret(shopDomain);
  console.log("[verifyWidgetToken] secret from Supabase:", secret);
  console.log("[verifyWidgetToken] secret found:", !!secret);

  if (!secret) {
    console.log("[verifyWidgetToken] FAIL — no secret in Supabase for this shop");
    return false;
  }

  const expected = signWidgetToken(shopDomain, secret);
  console.log("[verifyWidgetToken] expected token:", expected);
  console.log("[verifyWidgetToken] expected length:", expected.length);
  console.log("[verifyWidgetToken] lengths match:", expected.length === token?.length);
  console.log("[verifyWidgetToken] tokens match:", expected === token);

  if (expected.length !== token.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  const result = diff === 0;
  console.log("[verifyWidgetToken] final result:", result);
  return result;
}