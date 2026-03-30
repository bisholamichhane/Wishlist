/**
 * api.widget.wishlists.tsx
 *
 * Called by the storefront widget (customer browser).
 * No Shopify session — auth is via HMAC token from Liquid.
 *
 * GET  /api/widget/wishlists?shop=...&customerId=...&sessionId=...
 * POST /api/widget/wishlists   body: { shop, customerId, sessionId, name, isDefault }
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getShopByDomain, getWishlists, createWishlist } from "../supabase.server";
import { verifyWidgetToken } from "../utils/widget-auth.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Widget-Token",
    },
  });
}

// Preflight for CORS
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return json({});
  }

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId") || null;
  const sessionId = url.searchParams.get("sessionId") || null;
  const token = request.headers.get("X-Widget-Token");

  if (!shopDomain) return json({ error: "Missing shop" }, 400);
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop) return json({ error: "Shop not found" }, 404);

  const wishlists = await getWishlists(shop.id, customerId, sessionId);
  return json({ wishlists });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return json({});

  const body = await request.json();
  const { shop: shopDomain, customerId, sessionId, name, isDefault } = body;
  const token = request.headers.get("X-Widget-Token");

  if (!shopDomain) return json({ error: "Missing shop" }, 400);
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!name?.trim()) return json({ error: "Name is required" }, 400);

  const shop = await getShopByDomain(shopDomain);
  if (!shop) return json({ error: "Shop not found" }, 404);

  const wishlist = await createWishlist(
    shop.id,
    name.trim(),
    customerId || null,
    sessionId || null,
    isDefault ?? false
  );

  return json({ wishlist }, 201);
}
