import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── Types (matching your exact Supabase schema) ──────────────────────────────

export type Shop = {
  id: number;                    // int8
  created_at: string;            // timestamptz
  shop_domain: string;           // text
  access_token: string | null;   // text
  scope: string | null;          // text
  installed_at: string | null;   // timestamp
  uninstalled_at: string | null; // timestamp
  plan: string | null;           // text
};

export type Wishlist = {
  id: number;                    // int8
  created_at: string;            // timestamptz
  shop_id: number;               // int8 FK → shops.id
  customer_id: string | null;    // text
  session_id: string | null;     // text
  is_default: boolean;           // bool
  name: string;                  // text
};

export type WishlistItem = {
  id: number;                    // int8
  created_at: string;            // timestamptz
  wishlist_id: number;           // int8 FK → wishlists.id
  product_id: string;            // text
  variant_id: string | null;     // text
  product_title: string;         // text
  product_image: string | null;  // text
  product_price: number | null;  // numeric
  added_at: string;              // timestamp
};

export type Subscription = {
  id: number;                        // int8
  created_at: string;                // timestamptz
  shop_id: number;                   // int8 FK → shops.id
  shopify_charge_id: string | null;  // text
  status: string | null;             // text
  plan_name: string | null;          // text
  billing_on: string | null;         // timestamp
};

// ─── Shop helpers ─────────────────────────────────────────────────────────────

export async function upsertShop(
  shopDomain: string,
  accessToken?: string,
  scope?: string,
  widgetSecret?: string
) {
  const { data, error } = await supabase
    .from("shops")
    .upsert(
      {
        shop_domain: shopDomain,
        ...(accessToken ? { access_token: accessToken } : {}),
        ...(scope ? { scope } : {}),
        ...(widgetSecret ? { widget_secret: widgetSecret } : {}),
        installed_at: new Date().toISOString(),
        uninstalled_at: null,
      },
      { onConflict: "shop_domain" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Shop;
}

export async function getShopWidgetSecret(shopDomain: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("shops")
    .select("widget_secret")
    .eq("shop_domain", shopDomain)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as any)?.widget_secret ?? null;
}

export async function getShopByDomain(shopDomain: string) {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("shop_domain", shopDomain)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = row not found
  return data as Shop | null;
}

export async function markShopUninstalled(shopDomain: string) {
  const { error } = await supabase
    .from("shops")
    .update({ uninstalled_at: new Date().toISOString() })
    .eq("shop_domain", shopDomain);

  if (error) throw error;
}

// ─── Wishlist helpers ─────────────────────────────────────────────────────────

export async function getWishlists(
  shopId: number,
  customerId: string | null,
  sessionId: string | null
) {
  let query = supabase
    .from("wishlists")
    .select("*")
    .eq("shop_id", shopId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (customerId) {
    query = query.eq("customer_id", customerId);
  } else if (sessionId) {
    query = query.eq("session_id", sessionId);
  } else {
    return [] as Wishlist[];
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Wishlist[];
}

export async function createWishlist(
  shopId: number,
  name: string,
  customerId: string | null,
  sessionId: string | null,
  isDefault = false
) {
  // If this should be the default, clear the existing default first
  if (isDefault) {
    const col = customerId ? "customer_id" : "session_id";
    const val = customerId ?? sessionId;
    await supabase
      .from("wishlists")
      .update({ is_default: false })
      .eq("shop_id", shopId)
      .eq(col, val);
  }

  const { data, error } = await supabase
    .from("wishlists")
    .insert({
      shop_id: shopId,
      name,
      customer_id: customerId,
      session_id: sessionId,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Wishlist;
}

export async function renameWishlist(
  id: number,
  shopId: number,
  name: string
) {
  const { data, error } = await supabase
    .from("wishlists")
    .update({ name })
    .eq("id", id)
    .eq("shop_id", shopId)
    .select()
    .single();

  if (error) throw error;
  return data as Wishlist;
}

export async function setDefaultWishlist(
  id: number,
  shopId: number,
  customerId: string | null,
  sessionId: string | null
) {
  const col = customerId ? "customer_id" : "session_id";
  const val = customerId ?? sessionId;

  // Clear all defaults for this customer/session
  await supabase
    .from("wishlists")
    .update({ is_default: false })
    .eq("shop_id", shopId)
    .eq(col, val);

  // Set the chosen one as default
  const { data, error } = await supabase
    .from("wishlists")
    .update({ is_default: true })
    .eq("id", id)
    .eq("shop_id", shopId)
    .select()
    .single();

  if (error) throw error;
  return data as Wishlist;
}

export async function deleteWishlist(id: number, shopId: number) {
  const { error } = await supabase
    .from("wishlists")
    .delete()
    .eq("id", id)
    .eq("shop_id", shopId);

  if (error) throw error;
}

// ─── Wishlist item helpers ────────────────────────────────────────────────────

export async function getWishlistItems(wishlistId: number) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("wishlist_id", wishlistId)
    .order("added_at", { ascending: false });

  if (error) throw error;
  return data as WishlistItem[];
}

export async function addWishlistItem(
  wishlistId: number,
  item: {
    product_id: string;
    variant_id?: string;
    product_title: string;
    product_image?: string;
    product_price?: number;
  }
) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .upsert(
      {
        wishlist_id: wishlistId,
        product_id: item.product_id,
        variant_id: item.variant_id ?? null,
        product_title: item.product_title,
        product_image: item.product_image ?? null,
        product_price: item.product_price ?? null,
        added_at: new Date().toISOString(),
      },
      { onConflict: "wishlist_id,product_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as WishlistItem;
}

export async function removeWishlistItem(id: number, wishlistId: number) {
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("wishlist_id", wishlistId);

  if (error) throw error;
}

export async function isProductInAnyWishlist(
  shopId: number,
  productId: string,
  customerId: string | null,
  sessionId: string | null
) {
  let query = supabase
    .from("wishlists")
    .select("id")
    .eq("shop_id", shopId);

  if (customerId) {
    query = query.eq("customer_id", customerId);
  } else if (sessionId) {
    query = query.eq("session_id", sessionId);
  } else {
    return false;
  }

  const { data: wishlists } = await query;
  if (!wishlists?.length) return false;

  const ids = wishlists.map((w) => w.id);
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id")
    .in("wishlist_id", ids)
    .eq("product_id", productId)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

export async function getShopStats(shopId: number) {
  // Get wishlist IDs for this shop first
  const { data: wishlists } = await supabase
    .from("wishlists")
    .select("id")
    .eq("shop_id", shopId);

  const wishlistIds = wishlists?.map((w) => w.id) ?? [];

  const [{ count: totalWishlists }, { count: totalItems }] = await Promise.all([
    supabase
      .from("wishlists")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId),
    wishlistIds.length
      ? supabase
          .from("wishlist_items")
          .select("id", { count: "exact", head: true })
          .in("wishlist_id", wishlistIds)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    totalWishlists: totalWishlists ?? 0,
    totalItems: totalItems ?? 0,
  };
}

// ─── Subscription helpers ─────────────────────────────────────────────────────

export async function getSubscription(shopId: number) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Subscription | null;
}

export async function upsertSubscription(
  shopId: number,
  sub: {
    shopify_charge_id: string;
    status: string;
    plan_name: string;
    billing_on?: string;
  }
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        shop_id: shopId,
        shopify_charge_id: sub.shopify_charge_id,
        status: sub.status,
        plan_name: sub.plan_name,
        billing_on: sub.billing_on ?? null,
      },
      { onConflict: "shopify_charge_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Subscription;
}
