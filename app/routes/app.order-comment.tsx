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
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

const METAFIELD_NAMESPACE = "$app";
const LABEL_KEY = "order_comment_label";
const HELP_KEY = "order_comment_help";

const DEFAULT_LABEL = "Order comment";
const DEFAULT_HELP =
  "Add delivery instructions, a gift message, or other notes for your order.";

const SHOP_ORDER_COMMENT_QUERY = `#graphql
  query ShopOrderCommentSettings {
    shop {
      id
      label: metafield(namespace: "$app", key: "order_comment_label") {
        value
      }
      help: metafield(namespace: "$app", key: "order_comment_help") {
        value
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

  const res = await admin.graphql(SHOP_ORDER_COMMENT_QUERY);
  const json = await res.json();

  const label =
    json.data?.shop?.label?.value?.trim() || DEFAULT_LABEL;
  const helpText =
    json.data?.shop?.help?.value?.trim() || DEFAULT_HELP;

  return { label, helpText };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const label = (formData.get("label") as string)?.trim();
  const helpText = (formData.get("helpText") as string)?.trim();

  if (!label) {
    return { success: false, error: "Field label cannot be empty." };
  }

  const shopRes = await admin.graphql(SHOP_ORDER_COMMENT_QUERY);
  const shopJson = await shopRes.json();
  const shopId = shopJson.data?.shop?.id;

  if (!shopId) {
    return { success: false, error: "Could not load shop." };
  }

  const metafields = [
    {
      ownerId: shopId,
      namespace: METAFIELD_NAMESPACE,
      key: LABEL_KEY,
      type: "single_line_text_field",
      value: label,
    },
    {
      ownerId: shopId,
      namespace: METAFIELD_NAMESPACE,
      key: HELP_KEY,
      type: "single_line_text_field",
      value: helpText || DEFAULT_HELP,
    },
  ];

  const setRes = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: { metafields },
  });

  const setJson = await setRes.json();
  const userErrors = setJson.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    return {
      success: false,
      error: userErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  return { success: true, label, helpText: helpText || DEFAULT_HELP };
};

export default function OrderCommentPage() {
  const { label: savedLabel, helpText: savedHelp } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [label, setLabel] = useState(savedLabel);
  const [helpText, setHelpText] = useState(savedHelp);
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (result?.success) {
      if ("label" in result && result.label) setLabel(result.label);
      if ("helpText" in result && result.helpText) setHelpText(result.helpText);
    }
  }, [result]);

  const handleSave = useCallback(() => {
    fetcher.submit({ label, helpText }, { method: "POST" });
  }, [label, helpText, fetcher]);

  return (
    <Page>
      <TitleBar title="Order comment (checkout)" />
      <BlockStack gap="500">
        {result && !isLoading && (
          <Banner
            tone={result.success ? "success" : "critical"}
            onDismiss={() => {}}
          >
            {result.success
              ? "Checkout comment labels saved."
              : `Error: ${"error" in result ? result.error : "Unknown error"}`}
          </Banner>
        )}

        <Banner tone="info">
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              This is <Text as="span" fontWeight="semibold">not</Text> a field on
              the product page. Buyers type their comment during{" "}
              <Text as="span" fontWeight="semibold">checkout</Text> in the app
              block. After they click Save, it is stored as the order note.
            </Text>
          </BlockStack>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Checkout field labels
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Configure the label and helper text shown above the comment
                  field in checkout. The buyer&apos;s text is entered on
                  checkout only.
                </Text>

                <TextField
                  label="Field label"
                  value={label}
                  onChange={setLabel}
                  autoComplete="off"
                />

                <TextField
                  label="Helper text"
                  value={helpText}
                  onChange={setHelpText}
                  autoComplete="off"
                  multiline={2}
                />

                <Button variant="primary" loading={isLoading} onClick={handleSave}>
                  Save labels
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Where it appears
                </Text>
                <List type="number">
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Checkout block
                    </Text>{" "}
                    — store message (separate page)
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Order comment
                    </Text>{" "}
                    — buyer types here during checkout
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Admin → Orders
                    </Text>{" "}
                    — saved as order note after purchase
                  </List.Item>
                  <List.Item>
                    <Text as="span" fontWeight="semibold">
                      Order data
                    </Text>{" "}
                    — app page listing recent orders with notes
                  </List.Item>
                </List>
                <Text as="p" variant="bodySm" tone="subdued">
                  Product page comments need the Online Store theme (line item
                  properties), not this checkout extension.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
