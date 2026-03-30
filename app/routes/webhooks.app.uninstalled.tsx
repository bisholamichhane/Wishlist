import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { markShopUninstalled } from "../supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Mark the shop as uninstalled in Supabase
  try {
    await markShopUninstalled(shop);
  } catch (e) {
    console.error("Failed to mark shop uninstalled in Supabase:", e);
  }

  return new Response();
};
