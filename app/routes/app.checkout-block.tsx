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
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const CHECKOUT_BLOCK_METAFIELD_KEY = "checkout_block_text";
export const CHECKOUT_BLOCK_METAFIELD_NAMESPACE = "$app";
export const DEFAULT_CHECKOUT_BLOCK_TEXT =
  "Thank you for shopping with us!";

const SHOP_CHECKOUT_BLOCK_QUERY = `#graphql
  query ShopCheckoutBlockText {
    shop {
      id
      checkoutBlockText: metafield(
        namespace: "$app"
        key: "checkout_block_text"
      ) {
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

  const res = await admin.graphql(SHOP_CHECKOUT_BLOCK_QUERY);
  const json = await res.json();

  const text =
    json.data?.shop?.checkoutBlockText?.value?.trim() ||
    DEFAULT_CHECKOUT_BLOCK_TEXT;

  return { text };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const text = (formData.get("text") as string)?.trim();

  if (!text) {
    return { success: false, error: "Text cannot be empty." };
  }

  const shopRes = await admin.graphql(SHOP_CHECKOUT_BLOCK_QUERY);
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
          namespace: CHECKOUT_BLOCK_METAFIELD_NAMESPACE,
          key: CHECKOUT_BLOCK_METAFIELD_KEY,
          type: "single_line_text_field",
          value: text,
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

  return { success: true, text };
};

export default function CheckoutBlockPage() {
  const { text: savedText } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [text, setText] = useState(savedText);
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (result?.success && "text" in result && result.text) {
      setText(result.text);
    }
  }, [result]);

  const handleSave = useCallback(() => {
    fetcher.submit({ text }, { method: "POST" });
  }, [text, fetcher]);

  return (
    <Page>
      <TitleBar title="Checkout block" />
      <BlockStack gap="500">
        {result && !isLoading && (
          <Banner
            tone={result.success ? "success" : "critical"}
            onDismiss={() => {}}
          >
            {result.success
              ? "Checkout message saved. Open checkout preview to see it."
              : `Error: ${"error" in result ? result.error : "Unknown error"}`}
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Checkout message
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  This text appears in the custom UI block on checkout. After
                  saving here, add the block in{" "}
                  <Text as="span" fontWeight="semibold">
                    Settings → Checkout → Customize
                  </Text>{" "}
                  if it is not visible yet.
                </Text>

                <TextField
                  label="Message"
                  value={text}
                  onChange={setText}
                  autoComplete="off"
                  multiline={3}
                  helpText={`Default if empty on checkout: "${DEFAULT_CHECKOUT_BLOCK_TEXT}"`}
                />

                <Button variant="primary" loading={isLoading} onClick={handleSave}>
                  Save message
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Preview
                </Text>
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodyMd">
                    {text.trim() || DEFAULT_CHECKOUT_BLOCK_TEXT}
                  </Text>
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">
                  Extension target:{" "}
                  <Text as="span" fontWeight="medium">
                    purchase.checkout.block.render
                  </Text>
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
