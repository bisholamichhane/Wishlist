import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { DEFAULT_SETTINGS, getWishlistSettings, type WishlistSettings } from "./api.settings";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Call the logic directly via function import
  const { settings } = await getWishlistSettings(admin);

  return { settings: settings ?? DEFAULT_SETTINGS };
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isLoading = fetcher.state !== "idle";
  const saved = fetcher.state === "idle" && fetcher.data?.settings;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    
    const data: Partial<WishlistSettings> = {
      isEnabled: (form.elements.namedItem("isEnabled") as HTMLInputElement)?.checked,
      iconStyle: (form.elements.namedItem("iconStyle") as HTMLSelectElement)?.value as WishlistSettings["iconStyle"],
      iconPosition: (form.elements.namedItem("iconPosition") as HTMLSelectElement)?.value as WishlistSettings["iconPosition"],
      primaryColor: (form.elements.namedItem("primaryColor") as HTMLInputElement)?.value,
      buttonLayout: (form.elements.namedItem("buttonLayout") as HTMLSelectElement)?.value as WishlistSettings["buttonLayout"],
      drawerTitle: (form.elements.namedItem("drawerTitle") as HTMLInputElement)?.value,
      allowGuests: (form.elements.namedItem("allowGuests") as HTMLInputElement)?.checked,
    };

    fetcher.submit(JSON.stringify(data), {
      method: "POST",
      action: "/api/settings",
      encType: "application/json",
    });
  }

  const current: WishlistSettings = (fetcher.data?.settings as WishlistSettings) ?? settings;

  return (
    <s-page heading="Widget settings">
      <s-section heading="General">
        <form onSubmit={handleSave} id="settings-form">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" align="center">
              <s-text>Enable wishlist widget on storefront</s-text>
              <input
                type="checkbox"
                name="isEnabled"
                defaultChecked={current.isEnabled}
              />
            </s-stack>

            <s-stack direction="inline" gap="base" align="center">
              <s-text>Allow guest wishlists (localStorage fallback)</s-text>
              <input
                type="checkbox"
                name="allowGuests"
                defaultChecked={current.allowGuests}
              />
            </s-stack>

            <s-stack direction="block" gap="tight">
              <s-text>Drawer title</s-text>
              <input
                type="text"
                name="drawerTitle"
                defaultValue={current.drawerTitle}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc", width: "100%", maxWidth: 320 }}
              />
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      <s-section heading="Icon">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="tight">
            <s-text>Icon style</s-text>
            <select
              name="iconStyle"
              form="settings-form"
              defaultValue={current.iconStyle}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="heart">Heart</option>
              <option value="star">Star</option>
              <option value="bookmark">Bookmark</option>
            </select>
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text>Widget position</s-text>
            <select
              name="iconPosition"
              form="settings-form"
              defaultValue={current.iconPosition}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text>Button layout</s-text>
            <select
              name="buttonLayout"
              form="settings-form"
              defaultValue={current.buttonLayout}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="icon-only">Icon only</option>
              <option value="icon-text">Icon + text</option>
            </select>
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text>Primary colour</s-text>
            <input
              type="color"
              name="primaryColor"
              form="settings-form"
              defaultValue={current.primaryColor}
              style={{ width: 48, height: 36, borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}
            />
          </s-stack>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="App block">
        <s-paragraph>
          To show or hide the widget on your storefront, enable or disable the
          Wishlist app block in your theme editor.
        </s-paragraph>
        <s-button
          href="shopify://editor"
          target="_blank"
          variant="secondary"
        >
          Open theme editor
        </s-button>
      </s-section>

      <s-section slot="aside" heading="Save">
        <s-stack direction="block" gap="base">
          {saved && <s-banner status="success">Settings saved!</s-banner>}
          {fetcher.data?.error && (
            <s-banner status="critical">{fetcher.data.error}</s-banner>
          )}
          <s-button
            type="submit"
            form="settings-form"
            variant="primary"
            {...(isLoading ? { loading: true } : {})}
          >
            Save settings
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}