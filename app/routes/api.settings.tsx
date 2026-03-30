import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export type WishlistSettings = {
  isEnabled: boolean;
  iconStyle: "heart" | "star" | "bookmark";
  iconPosition: "bottom-right" | "bottom-left";
  primaryColor: string;
  buttonLayout: "icon-only" | "icon-text";
  drawerTitle: string;
  allowGuests: boolean;
};

export const DEFAULT_SETTINGS: WishlistSettings = {
  isEnabled: true,
  iconStyle: "heart",
  iconPosition: "bottom-right",
  primaryColor: "#000000",
  buttonLayout: "icon-only",
  drawerTitle: "My Wishlists",
  allowGuests: true,
};

const GET_SETTINGS_QUERY = `#graphql
  query GetWishlistSettings {
    shop {
      id
      metafield(namespace: "custom", key: "wishlistSettings") {
        id
        value
      }
    }
  }
`;

const SET_SETTINGS_MUTATION = `#graphql
  mutation SetWishlistSettings($shopId: ID!, $value: String!) {
    metafieldsSet(metafields: [{
      ownerId: $shopId
      namespace: "custom"
      key: "wishlistSettings"
      type: "json"
      value: $value
    }]) {
      metafields {
        id
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** * SHARED LOGIC: Get Settings
 */
export async function getWishlistSettings(admin: any) {
  const response = await admin.graphql(GET_SETTINGS_QUERY);
  const { data } = await response.json();
  const raw = data?.shop?.metafield?.value;

  let settings: WishlistSettings = DEFAULT_SETTINGS;
  if (raw) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* corrupted fallback */ }
  }

  return {
    settings,
    shopId: data?.shop?.id,
    metafieldId: data?.shop?.metafield?.id ?? null,
  };
}

/** * SHARED LOGIC: Update Settings
 */
export async function updateWishlistSettings(admin: any, newSettings: Partial<WishlistSettings>) {
  const { shopId } = await getWishlistSettings(admin);

  if (!shopId) throw new Error("Could not resolve shop ID");

  const mergedSettings: WishlistSettings = {
    ...DEFAULT_SETTINGS,
    ...newSettings,
  };

  const response = await admin.graphql(SET_SETTINGS_MUTATION, {
    variables: {
      shopId,
      value: JSON.stringify(mergedSettings),
    },
  });

  const { data } = await response.json();
  return {
    settings: mergedSettings,
    errors: data?.metafieldsSet?.userErrors || [],
  };
}

// Loader for the /api/settings route
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const data = await getWishlistSettings(admin);
  return jsonResponse(data);
}

// Action for the /api/settings route
export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const body = await request.json();
  
  const { settings, errors } = await updateWishlistSettings(admin, body);

  if (errors.length) {
    return jsonResponse({ error: errors[0].message }, 400);
  }

  return jsonResponse({ settings });
}