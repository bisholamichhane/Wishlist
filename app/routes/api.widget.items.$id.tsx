/**
 * api.widget.items.$id.tsx
 *
 * DELETE /api/widget/items/:id  body: { shop, wishlistId }
 *
 * FIX: removeWishlistItem(id, wishlistId) takes numbers, but params.id and
 * body.wishlistId arrive as strings. Added Number() coercion + NaN guard.
 */

import type { ActionFunctionArgs } from "react-router";
import { removeWishlistItem } from "../supabase.server";
import { verifyWidgetToken } from "../utils/widget-auth.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Widget-Token",
    },
  });
}

export async function loader() {
  return json({});
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") return json({});

  const rawId = params.id;
  if (!rawId) return json({ error: "Missing id" }, 400);

  const itemId = Number(rawId);
  if (isNaN(itemId)) return json({ error: "Invalid id" }, 400);

  const body = await request.json();
  const { shop: shopDomain, wishlistId: rawWishlistId } = body;
  const token = request.headers.get("X-Widget-Token");

  if (!shopDomain || rawWishlistId === undefined) {
    return json({ error: "Missing fields" }, 400);
  }
  if (!token || !await verifyWidgetToken(shopDomain, token)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const wishlistId = Number(rawWishlistId);
  if (isNaN(wishlistId)) return json({ error: "Invalid wishlistId" }, 400);

  await removeWishlistItem(itemId, wishlistId);
  return json({ success: true });
}