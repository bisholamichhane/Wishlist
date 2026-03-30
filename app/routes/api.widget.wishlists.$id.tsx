/**
 * api.widget.wishlists.$id.items.tsx
 *
 * This route was MISSING. The storefront widget calls:
 *   GET  /api/widget/wishlists/:id/items?shop=...
 *   POST /api/widget/wishlists/:id/items   body: { shop, customerId, sessionId, product_id, ... }
 *
 * The old code only had /api/widget/items (without the wishlist id in the path)
 * which caused all "open a list" clicks to fail silently (items never loaded).
 *
 * GET  — returns all items in the wishlist (verifies shop ownership)
 * POST — adds an item to the wishlist (used by the per-product heart button)
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  getShopByDomain,
  getWishlistItems,
  addWishlistItem,
} from "../supabase.server";
import { verifyWidgetToken } from "../utils/widget-auth.server";
import { supabase } from "../supabase.server";

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

// ─── GET — load items for a wishlist ─────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") return json({});

  const wishlistId = Number(params.id);
  if (isNaN(wishlistId)) return json({ error: "Invalid wishlist id" }, 400);

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const token = request.headers.get("X-Widget-Token");

  if (!shopDomain) return json({ error: "Missing shop" }, 400);
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Verify this wishlist belongs to this shop (security check)
  const shop = await getShopByDomain(shopDomain);
  if (!shop) return json({ error: "Shop not found" }, 404);

  const { data: wl } = await supabase
    .from("wishlists")
    .select("id")
    .eq("id", wishlistId)
    .eq("shop_id", shop.id)
    .single();

  if (!wl) return json({ error: "Wishlist not found" }, 404);

  const items = await getWishlistItems(wishlistId);
  return json({ items });
}

// ─── POST — add an item to a wishlist ────────────────────────────────────────

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return json({});

  const wishlistId = Number(params.id);
  if (isNaN(wishlistId)) return json({ error: "Invalid wishlist id" }, 400);

  const body = await request.json();
  const {
    shop: shopDomain,
    product_id,
    variant_id,
    product_title,
    product_image,
    product_price,
  } = body;
  const token = request.headers.get("X-Widget-Token");

  if (!shopDomain || !product_id || !product_title) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Verify wishlist belongs to this shop
  const shop = await getShopByDomain(shopDomain);
  if (!shop) return json({ error: "Shop not found" }, 404);

  const { data: wl } = await supabase
    .from("wishlists")
    .select("id")
    .eq("id", wishlistId)
    .eq("shop_id", shop.id)
    .single();

  if (!wl) return json({ error: "Wishlist not found" }, 404);

  const item = await addWishlistItem(wishlistId, {
    product_id,
    variant_id,
    product_title,
    product_image,
    product_price,
  });

  return json({ item }, 201);
}