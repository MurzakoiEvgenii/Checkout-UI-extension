import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  TextField,
  Button,
  Banner,
  Select,
  Checkbox,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  DEFAULT_UPSELL_MAX,
  UPSELL_CONFIG_KEY,
  UPSELL_METAFIELD_NAMESPACE,
  UPSELL_MODES,
  UPSELL_PLACEMENTS,
  parseUpsellConfig,
  placementEditorHint,
  placementLabel,
  serializeUpsellConfig,
  type UpsellConfig,
  type UpsellMode,
  type UpsellPlacement,
} from "../lib/upsell-config";

const SHOP_UPSELL_QUERY = `#graphql
  query ShopUpsellSettings {
    shop {
      id
      upsellConfig: metafield(namespace: "$app", key: "upsell_config") {
        value
      }
    }
    collections(first: 50, sortKey: TITLE) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        key
        namespace
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(SHOP_UPSELL_QUERY);
  const json = await res.json();

  const config = parseUpsellConfig(json.data?.shop?.upsellConfig?.value);

  const collections =
    json.data?.collections?.edges?.map(
      (edge: { node: { id: string; title: string } }) => edge.node,
    ) ?? [];

  return { config, collections };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const config: UpsellConfig = {
    enabled: formData.get("enabled") === "true",
    heading: (formData.get("heading") as string)?.trim() || "",
    placement: formData.get("placement") as UpsellPlacement,
    mode: formData.get("mode") as UpsellMode,
    collectionId: (formData.get("collectionId") as string) ?? "",
    cartTriggerTag: (formData.get("cartTriggerTag") as string)?.trim() ?? "",
    maxProducts: parseInt(formData.get("maxProducts") as string, 10),
  };

  if (!config.heading) {
    return { success: false, error: "Heading cannot be empty." };
  }

  if (
    (config.mode === "collection" || config.mode === "cart_tag") &&
    config.enabled &&
    !config.collectionId
  ) {
    return {
      success: false,
      error: "Choose a collection for this upsell mode.",
    };
  }

  if (config.mode === "cart_tag" && config.enabled && !config.cartTriggerTag) {
    return {
      success: false,
      error: "Enter a cart trigger tag for cart-tag mode.",
    };
  }

  if (!Number.isFinite(config.maxProducts) || config.maxProducts < 1) {
    config.maxProducts = DEFAULT_UPSELL_MAX;
  }

  config.maxProducts = Math.min(config.maxProducts, 6);

  const shopRes = await admin.graphql(SHOP_UPSELL_QUERY);
  const shopJson = await shopRes.json();
  const shopId = shopJson.data?.shop?.id;

  if (!shopId) {
    return { success: false, error: "Could not load shop." };
  }

  const setRes = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: UPSELL_METAFIELD_NAMESPACE,
          key: UPSELL_CONFIG_KEY,
          type: "json",
          value: serializeUpsellConfig(config),
        },
      ],
    },
  });

  const setJson = await setRes.json();
  const userErrors = setJson.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    return {
      success: false,
      error: userErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  return { success: true, config };
};

export default function UpsellPage() {
  const { config: initialConfig, collections } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [config, setConfig] = useState<UpsellConfig>(initialConfig);
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (result?.success && "config" in result && result.config) {
      setConfig(result.config);
    }
  }, [result]);

  const updateConfig = useCallback(
    (patch: Partial<UpsellConfig>) => {
      setConfig((current) => ({ ...current, ...patch }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    fetcher.submit(
      {
        enabled: String(config.enabled),
        heading: config.heading,
        placement: config.placement,
        mode: config.mode,
        collectionId: config.collectionId,
        cartTriggerTag: config.cartTriggerTag,
        maxProducts: String(config.maxProducts),
      },
      { method: "POST" },
    );
  }, [config, fetcher]);

  const collectionOptions = [
    { label: "Select a collection", value: "" },
    ...collections.map((c) => ({
      label: c.title,
      value: c.id,
    })),
  ];

  const needsCollection =
    config.mode === "collection" || config.mode === "cart_tag";
  const showTagField = config.mode === "cart_tag";

  return (
    <Page>
      <TitleBar title="Upsell (checkout)" />
      <BlockStack gap="500">
        {result && !isLoading && (
          <Banner tone={result.success ? "success" : "critical"}>
            {result.success
              ? "Upsell settings saved. Add the block in checkout customization (see steps on the right)."
              : `Error: ${"error" in result ? result.error : "Unknown error"}`}
          </Banner>
        )}

        <Banner tone="info">
          Products are chosen automatically (not already in the cart). In
          checkout editor, add the{" "}
          <Text as="span" fontWeight="semibold">
            Upsell offers
          </Text>{" "}
          block under Order summary. Placement below is a hint for where to put
          that block — the offers show wherever you add it.
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Upsell offers
                </Text>

                <Checkbox
                  label="Enable upsell on checkout"
                  checked={config.enabled}
                  onChange={(enabled) => updateConfig({ enabled })}
                />

                <TextField
                  label="Block heading"
                  value={config.heading}
                  onChange={(heading) => updateConfig({ heading })}
                  autoComplete="off"
                />

                <Select
                  label="Render placement (checkout target)"
                  options={UPSELL_PLACEMENTS.map((p) => ({
                    label: p.label,
                    value: p.value,
                  }))}
                  value={config.placement}
                  onChange={(placement) =>
                    updateConfig({ placement: placement as UpsellPlacement })
                  }
                  helpText={placementEditorHint(config.placement)}
                />

                <Select
                  label="Automatic product logic"
                  options={UPSELL_MODES.map((m) => ({
                    label: m.label,
                    value: m.value,
                  }))}
                  value={config.mode}
                  onChange={(mode) =>
                    updateConfig({ mode: mode as UpsellMode })
                  }
                />

                {needsCollection && (
                  <Select
                    label="Upsell collection"
                    options={collectionOptions}
                    value={config.collectionId}
                    onChange={(collectionId) => updateConfig({ collectionId })}
                    helpText="Products from this collection; items already in the cart are hidden."
                  />
                )}

                {showTagField && (
                  <TextField
                    label="Cart trigger tag"
                    value={config.cartTriggerTag}
                    onChange={(cartTriggerTag) =>
                      updateConfig({ cartTriggerTag })
                    }
                    autoComplete="off"
                    helpText="Upsell collection is shown only when a cart product has this tag (case-insensitive)."
                  />
                )}

                <TextField
                  label="Maximum products to show"
                  type="number"
                  value={String(config.maxProducts)}
                  onChange={(value) =>
                    updateConfig({
                      maxProducts: parseInt(value, 10) || DEFAULT_UPSELL_MAX,
                    })
                  }
                  autoComplete="off"
                  min={1}
                  max={6}
                />

                <Button variant="primary" loading={isLoading} onClick={handleSave}>
                  Save upsell settings
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Add block in checkout editor
                </Text>
                <List type="number">
                  <List.Item>Settings → Checkout → Customize</List.Item>
                  <List.Item>
                    In Order summary (or Main), click{" "}
                    <Text as="span" fontWeight="semibold">
                      Add block
                    </Text>{" "}
                    and choose{" "}
                    <Text as="span" fontWeight="semibold">
                      Upsell offers
                    </Text>{" "}
                    (not checkout-custom-block). Placement:{" "}
                    {placementLabel(config.placement)}.
                  </List.Item>
                  <List.Item>
                    Enable upsell in this app and save a collection before
                    testing.
                  </List.Item>
                  <List.Item>Save and test with items in the cart</List.Item>
                </List>
                <Text as="p" variant="bodySm" tone="subdued">
                  The block only renders on the target selected above.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
