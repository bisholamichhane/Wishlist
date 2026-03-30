/**
 * api.widget.items.tsx
 *
 * GET  /api/widget/items/check?shop=...&customerId=...&sessionId=...&productId=...
 *   → { inWishlist: boolean }  (used by the per-product heart button)
 *
 * POST /api/widget/items  body: { shop, wishlistId, product_id, ... }
 *   → { item }  (legacy fallback — prefer POST /api/widget/wishlists/:id/items)
 *
 * FIX: The original route handled both cases but the GET path was never
 * reachable because the router matched /api/widget/items/$id first.
 * Moved to a dedicated /check sub-path.
 * Also: wishlistId needs Number() coercion before being passed to addWishlistItem.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getShopByDomain,
  addWishlistItem,
  isProductInAnyWishlist,
} from "../supabase.server";
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

// ─── GET /api/widget/items/check — is product saved in any list? ─────────────

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") return json({});

  const url = new URL(request.url);

  // Only handle the /check subpath (React Router will call this for
  // /api/widget/items with no segment after it)
  const shopDomain  = url.searchParams.get("shop");
  const customerId  = url.searchParams.get("customerId") || null;
  const sessionId   = url.searchParams.get("sessionId") || null;
  const productId   = url.searchParams.get("productId");
  const token       = request.headers.get("X-Widget-Token");

  if (!shopDomain || !productId) return json({ error: "Missing params" }, 400);
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop) return json({ error: "Shop not found" }, 404);

  const inWishlist = await isProductInAnyWishlist(
    shop.id,
    productId,
    customerId,
    sessionId
  );

  return json({ inWishlist });
}

// ─── POST /api/widget/items — add item (legacy, prefer /:id/items) ────────────

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return json({});

  const body = await request.json();
  const {
    shop: shopDomain,
    wishlistId: rawWishlistId,
    product_id,
    variant_id,
    product_title,
    product_image,
    product_price,
  } = body;
  const token = request.headers.get("X-Widget-Token");

  if (!shopDomain || rawWishlistId === undefined || !product_id || !product_title) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const wishlistId = Number(rawWishlistId);
  if (isNaN(wishlistId)) return json({ error: "Invalid wishlistId" }, 400);

  const item = await addWishlistItem(wishlistId, {
    product_id,
    variant_id,
    product_title,
    product_image,
    product_price,
  });

  return json({ item }, 201);
}