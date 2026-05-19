import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Banner,
  List,
  Link,
  DataTable,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

const RECENT_ORDERS_QUERY = `#graphql
  query RecentOrdersWithNotes($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          note
          displayFinancialStatus
        }
      }
    }
  }
`;

type OrderRow = {
  id: string;
  name: string;
  createdAt: string;
  note: string;
  hasNote: boolean;
  status: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const shopDomain = session.shop;
  const adminOrdersUrl = `https://${shopDomain}/admin/orders`;

  try {
    const res = await admin.graphql(RECENT_ORDERS_QUERY, {
      variables: { first: 25 },
    });
    const json = await res.json();

    const graphQLError =
      json.errors?.[0]?.message ??
      (json.data?.orders ? null : "Could not load orders.");

    if (graphQLError) {
      const pcdBlocked = graphQLError.includes("not approved") ||
        graphQLError.includes("protected");

      return {
        adminOrdersUrl,
        orders: [] as OrderRow[],
        ordersWithNotesCount: 0,
        pcdBlocked,
        loadError: graphQLError,
      };
    }

    const orders: OrderRow[] =
      json.data?.orders?.edges?.map(
        (edge: {
          node: {
            id: string;
            name: string;
            createdAt: string;
            note: string | null;
            displayFinancialStatus: string;
          };
        }) => ({
          id: edge.node.id,
          name: edge.node.name,
          createdAt: edge.node.createdAt,
          note: edge.node.note?.trim() || "",
          hasNote: Boolean(edge.node.note?.trim()),
          status: edge.node.displayFinancialStatus,
        }),
      ) ?? [];

    return {
      adminOrdersUrl,
      orders,
      ordersWithNotesCount: orders.filter((o) => o.hasNote).length,
      pcdBlocked: false,
      loadError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load orders.";
    const pcdBlocked =
      message.includes("not approved") || message.includes("protected");

    return {
      adminOrdersUrl,
      orders: [] as OrderRow[],
      ordersWithNotesCount: 0,
      pcdBlocked,
      loadError: message,
    };
  }
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function OrderDataPage() {
  const {
    adminOrdersUrl,
    orders,
    ordersWithNotesCount,
    pcdBlocked,
    loadError,
  } = useLoaderData<typeof loader>();

  const rows = orders.map((order) => [
    order.name,
    formatDate(order.createdAt),
    order.status,
    order.hasNote ? (
      <Badge tone="success">Has note</Badge>
    ) : (
      <Badge>No note</Badge>
    ),
    order.note || "—",
  ]);

  return (
    <Page>
      <TitleBar title="Order data" />
      <BlockStack gap="500">
        <Banner tone="success">
          New checkout comments are saved as the order Note when the customer
          pays. This page can list recent orders once API access is enabled.
        </Banner>

        {pcdBlocked && (
          <Banner tone="warning" title="Order list requires API access">
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                To load past orders in this app, enable Protected customer data
                (Level 1) for <Text as="span" fontWeight="semibold">newBrandCheckout</Text>{" "}
                in the Partner Dashboard. You do not need App Store review for a
                dev store only app.
              </Text>
              <List type="number">
                <List.Item>
                  <Link
                    url="https://partners.shopify.com"
                    target="_blank"
                  >
                    partners.shopify.com
                  </Link>{" "}
                  → Apps → newBrandCheckout → API access
                </List.Item>
                <List.Item>
                  Protected customer data access → Request access → Level 1
                  (order notes only, no email/address needed)
                </List.Item>
                <List.Item>
                  Add <Text as="span" fontWeight="semibold">read_orders</Text>{" "}
                  scope in app config, restart{" "}
                  <Text as="span" fontWeight="semibold">shopify app dev</Text>
                </List.Item>
              </List>
              <Text as="p" variant="bodySm" tone="subdued">
                Until then, open orders in{" "}
                <Link url={adminOrdersUrl} target="_blank">
                  Shopify Admin
                </Link>
                . Comments cannot be added to orders that already completed
                without a note — only new checkouts can save a comment.
              </Text>
            </BlockStack>
          </Banner>
        )}

        {loadError && !pcdBlocked && (
          <Banner tone="critical">Could not load orders: {loadError}</Banner>
        )}

        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Summary
                </Text>
                {orders.length > 0 ? (
                  <>
                    <Text as="p" variant="bodyMd">
                      Recent orders:{" "}
                      <Text as="span" fontWeight="semibold">
                        {orders.length}
                      </Text>
                    </Text>
                    <Text as="p" variant="bodyMd">
                      With a note:{" "}
                      <Text as="span" fontWeight="semibold">
                        {ordersWithNotesCount}
                      </Text>
                    </Text>
                  </>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No orders loaded yet.
                  </Text>
                )}
                <Text as="p" variant="bodySm" tone="subdued">
                  Default API access includes orders from the last 60 days.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Recent orders
                </Text>
                {orders.length === 0 ? (
                  <Text as="p" tone="subdued">
                    {pcdBlocked
                      ? "Enable Protected customer data access to see orders here."
                      : "No orders yet."}
                  </Text>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                    ]}
                    headings={[
                      "Order",
                      "Created",
                      "Payment",
                      "Comment",
                      "Note text",
                    ]}
                    rows={rows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
