/**
 * app.analytics.tsx
 *
 * Analytics dashboard for the merchant.
 *
 * FIXES vs original:
 *  - Added HeadersFunction export (required for the Shopify boundary to work;
 *    without it the page will sometimes throw on navigation)
 *  - Richer stats: top wishlisted products, recent activity
 *  - Proper empty states
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShopByDomain, supabase } from "../supabase.server";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getShopByDomain(session.shop);
  if (!shop) return { stats: null, topProducts: [], recentLists: [] };

  // Basic counts
  const [{ count: totalWishlists }, wishlistsData] = await Promise.all([
    supabase
      .from("wishlists")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shop.id),
    supabase
      .from("wishlists")
      .select("id, name, created_at, customer_id")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const wishlistIds = wishlistsData.data?.map((w) => w.id) ?? [];

  // Total items
  const { count: totalItems } = wishlistIds.length
    ? await supabase
        .from("wishlist_items")
        .select("id", { count: "exact", head: true })
        .in("wishlist_id", wishlistIds)
    : { count: 0 };

  // Top wishlisted products (aggregate by product_id across all wishlists for this shop)
  let topProducts: { product_title: string; product_image: string | null; count: number }[] = [];
  if (wishlistIds.length) {
    const { data: items } = await supabase
      .from("wishlist_items")
      .select("product_id, product_title, product_image")
      .in("wishlist_id", wishlistIds);

    if (items) {
      const counts: Record<string, { product_title: string; product_image: string | null; count: number }> = {};
      for (const item of items) {
        if (!counts[item.product_id]) {
          counts[item.product_id] = {
            product_title: item.product_title,
            product_image: item.product_image,
            count: 0,
          };
        }
        counts[item.product_id].count++;
      }
      topProducts = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }
  }

  // Unique customers (by customer_id, non-null)
  const { data: customerRows } = await supabase
    .from("wishlists")
    .select("customer_id")
    .eq("shop_id", shop.id)
    .not("customer_id", "is", null);

  const uniqueCustomers = new Set(customerRows?.map((r) => r.customer_id)).size;

  return {
    stats: {
      totalWishlists: totalWishlists ?? 0,
      totalItems: totalItems ?? 0,
      uniqueCustomers,
    },
    topProducts,
    recentLists: wishlistsData.data ?? [],
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { stats, topProducts, recentLists } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Analytics">

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <s-section heading="Overview">
        {stats ? (
          <s-stack direction="inline" gap="base">
            <StatCard value={stats.totalWishlists} label="Total wishlists" />
            <StatCard value={stats.totalItems} label="Items saved" />
            <StatCard value={stats.uniqueCustomers} label="Logged-in customers" />
            <StatCard
              value={stats.totalWishlists > 0
                ? (stats.totalItems / stats.totalWishlists).toFixed(1)
                : "—"}
              label="Avg items / list"
            />
          </s-stack>
        ) : (
          <s-paragraph>
            No data yet — stats appear once customers create their first wishlists.
          </s-paragraph>
        )}
      </s-section>

      {/* ── Top products ──────────────────────────────────────────── */}
      <s-section heading="Most wishlisted products">
        {topProducts.length > 0 ? (
          <div>
            {topProducts.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < topProducts.length - 1 ? "1px solid #f2f2f2" : "none",
                }}
              >
                <div style={{ width: 32, color: "#888", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                  #{i + 1}
                </div>
                {p.product_image ? (
                  <img
                    src={p.product_image}
                    alt={p.product_title}
                    style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 6, background: "#f5f5f5", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.product_title}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#555", flexShrink: 0 }}>
                  {p.count} {p.count === 1 ? "save" : "saves"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <s-paragraph>No products wishlisted yet.</s-paragraph>
        )}
      </s-section>

      {/* ── Recent wishlists (aside) ──────────────────────────────── */}
      <s-section slot="aside" heading="Recent wishlists">
        {recentLists.length > 0 ? (
          <s-stack direction="block" gap="tight">
            {recentLists.map((w: { id: number; name: string; created_at: string; customer_id: string | null }) => (
              <div key={w.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                <div style={{ fontWeight: 500, color: "#111" }}>{w.name}</div>
                <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                  {w.customer_id ? `Customer ${w.customer_id.slice(0, 8)}…` : "Guest"}
                  {" · "}
                  {new Date(w.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>No wishlists created yet.</s-paragraph>
        )}
      </s-section>

    </s-page>
  );
}

// ─── Small stat card ──────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
      style={{ flex: 1, textAlign: "center" }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, color: "#111", lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{label}</div>
    </s-box>
  );
}

// ─── Required for Shopify boundary ────────────────────────────────────────────

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};