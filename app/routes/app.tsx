import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { upsertShop, getShopWidgetSecret } from "../supabase.server";
import { generateNewWidgetSecret } from "../utils/widget-auth.server";

const SET_WIDGET_SECRET_MUTATION = `#graphql
  mutation SetWidgetSecret($shopId: ID!, $secret: String!) {
    metafieldsSet(metafields: [{
      ownerId: $shopId
      namespace: "custom"
      key: "wishlist_widget_secret"
      type: "single_line_text_field"
      value: $secret
    }]) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

const GET_SHOP_ID_QUERY = `#graphql
  query GetShopId {
    shop { id }
  }
`;

async function ensureWidgetSecret(admin: any, shopDomain: string) {
  console.log("[widget-secret] checking Supabase for existing secret...");
  let secret = await getShopWidgetSecret(shopDomain);
  console.log("[widget-secret] existing secret found:", !!secret);

  if (!secret) {
    secret = generateNewWidgetSecret();
    console.log("[widget-secret] generated new secret");
  }

  console.log("[widget-secret] fetching shop GID from Shopify...");
  const shopRes = await admin.graphql(GET_SHOP_ID_QUERY);
  const shopJson = await shopRes.json();
  console.log("[widget-secret] shop GID response:", JSON.stringify(shopJson));

  const shopId = shopJson?.data?.shop?.id;
  if (!shopId) {
    throw new Error("[widget-secret] Could not get shop GID from Shopify API");
  }

  console.log("[widget-secret] writing metafield for shopId:", shopId);
  const metaRes = await admin.graphql(SET_WIDGET_SECRET_MUTATION, {
    variables: { shopId, secret },
  });
  const metaJson = await metaRes.json();
  console.log("[widget-secret] metafield result:", JSON.stringify(metaJson));

  const userErrors = metaJson?.data?.metafieldsSet?.userErrors;
  if (userErrors?.length) {
    throw new Error(`[widget-secret] metafieldsSet userErrors: ${JSON.stringify(userErrors)}`);
  }

  return secret;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[app.tsx loader] authenticating...");
  const { session, admin } = await authenticate.admin(request);
  console.log("[app.tsx loader] shop:", session.shop);
  console.log("[app.tsx loader] accessToken present:", !!session.accessToken);

  try {
    console.log("[app.tsx loader] running ensureWidgetSecret...");
    const secret = await ensureWidgetSecret(admin, session.shop);

    console.log("[app.tsx loader] upserting shop in Supabase...");
    const result = await upsertShop(
      session.shop,
      session.accessToken ?? undefined,
      undefined,
      secret
    );
    console.log("[app.tsx loader] upsertShop result:", JSON.stringify(result));
  } catch (e) {
    // Log the FULL error — no more silent swallowing
    console.error("[app.tsx loader] FULL ERROR:", e);
    if (e instanceof Error) {
      console.error("[app.tsx loader] message:", e.message);
      console.error("[app.tsx loader] stack:", e.stack);
    }
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/settings">Widget settings</s-link>
        <s-link href="/app/analytics">Analytics</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};