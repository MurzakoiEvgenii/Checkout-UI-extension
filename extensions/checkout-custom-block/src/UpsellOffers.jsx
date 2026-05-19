import { useEffect, useState } from "preact/hooks";

export const UPSELL_BLOCK_PLACEMENT = "purchase.checkout.block.render";

const UPSELL_CONFIG_KEY = "upsell_config";
const PLACEHOLDER_IMAGE =
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081";

function findShopMetafield(key) {
  const entry = shopify.appMetafields.value.find(
    (item) =>
      item.target.type === "shop" &&
      item.metafield.namespace === "$app" &&
      item.metafield.key === key,
  );

  return entry?.metafield?.value?.trim() || "";
}

function readConfig() {
  const raw = findShopMetafield(UPSELL_CONFIG_KEY);
  const defaults = {
    enabled: false,
    heading: "You might also like",
    placement: "purchase.checkout.cart-line-list.render-after",
    mode: "collection",
    collectionId: "",
    cartTriggerTag: "",
    maxProducts: 3,
  };

  if (!raw) {
    return defaults;
  }

  try {
    const data = JSON.parse(raw);
    const maxRaw = Number(data.maxProducts);

    return {
      enabled: Boolean(data.enabled),
      heading: data.heading?.trim() || defaults.heading,
      placement: data.placement || defaults.placement,
      mode: data.mode || defaults.mode,
      collectionId: data.collectionId || "",
      cartTriggerTag: (data.cartTriggerTag || "").toLowerCase(),
      maxProducts:
        Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(maxRaw, 6) : 3,
    };
  } catch {
    return defaults;
  }
}

function getCartVariantIds(lines) {
  return lines.map((line) => line.merchandise.id);
}

function filterNotInCart(products, cartVariantIds) {
  return products.filter((product) => {
    const variantIds = product.variants?.nodes?.map((v) => v.id) ?? [];
    return !variantIds.some((id) => cartVariantIds.includes(id));
  });
}

function collectionFetchLimit(maxProducts, cartLineCount) {
  return Math.min(Math.max(maxProducts + cartLineCount + 5, 10), 20);
}

function normalizeProductNodes(nodes) {
  return (nodes ?? []).map((node) => ({
    id: node.id,
    title: node.title,
    images: node.images,
    variants: node.variants,
  }));
}

/**
 * @param {{ embeddedInMainBlock?: boolean }} props
 * Set when rendered inside checkout-custom-block (message + comment).
 */
export function UpsellOffers({ embeddedInMainBlock = false }) {
  const config = readConfig();
  const canAddToCart = shopify.instructions.value.lines.canAddCartLine;

  const shouldRender =
    config.enabled &&
    (!embeddedInMainBlock ||
      config.placement === UPSELL_BLOCK_PLACEMENT);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [showError, setShowError] = useState(false);

  const cartLines = shopify.lines.value;
  const cartSignature = cartLines
    .map((line) => `${line.id}:${line.merchandise.id}`)
    .join("|");

  useEffect(() => {
    if (!shouldRender) return;

    loadOffers();
  }, [
    shouldRender,
    config.mode,
    config.collectionId,
    config.cartTriggerTag,
    config.maxProducts,
    cartSignature,
  ]);

  useEffect(() => {
    if (!showError) return;
    const timer = setTimeout(() => setShowError(false), 3000);
    return () => clearTimeout(timer);
  }, [showError]);

  async function loadOffers() {
    if (!shouldRender) {
      setProducts([]);
      return;
    }

    setLoading(true);

    try {
      const cartVariantIds = getCartVariantIds(cartLines);
      let nodes = [];

      if (config.mode === "recommendations") {
        nodes = await fetchRecommendations(cartLines, config.maxProducts);
      } else if (config.mode === "cart_tag") {
        const showCollection = await cartMatchesTriggerTag(
          cartLines,
          config.cartTriggerTag,
        );
        if (showCollection && config.collectionId) {
          nodes = await fetchCollectionProducts(
            config.collectionId,
            collectionFetchLimit(config.maxProducts, cartVariantIds.length),
          );
        }
      } else if (config.collectionId) {
        nodes = await fetchCollectionProducts(
          config.collectionId,
          collectionFetchLimit(config.maxProducts, cartVariantIds.length),
        );
      }

      const filtered = filterNotInCart(
        normalizeProductNodes(nodes),
        cartVariantIds,
      ).slice(0, config.maxProducts);

      setProducts(filtered);
    } catch (error) {
      console.error("Upsell load failed", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCollectionProducts(collectionId, first) {
    const { data } = await shopify.query(
      `query UpsellCollection($id: ID!, $first: Int!) {
        collection(id: $id) {
          products(first: $first) {
            nodes {
              id
              title
              images(first: 1) {
                nodes {
                  url
                }
              }
              variants(first: 1) {
                nodes {
                  id
                  price {
                    amount
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: { id: collectionId, first } },
    );

    return data?.collection?.products?.nodes ?? [];
  }

  async function fetchRecommendations(cartLines, maxProducts) {
    const firstLine = cartLines[0];
    const productId = firstLine?.merchandise?.product?.id;

    if (!productId) {
      return [];
    }

    const { data } = await shopify.query(
      `query UpsellRecommendations($productId: ID!) {
        productRecommendations(productId: $productId) {
          id
          title
          images(first: 1) {
            nodes {
              url
            }
          }
          variants(first: 1) {
            nodes {
              id
              price {
                amount
              }
            }
          }
        }
      }`,
      { variables: { productId } },
    );

    return (data?.productRecommendations ?? []).slice(0, maxProducts);
  }

  async function cartMatchesTriggerTag(cartLines, triggerTag) {
    if (!triggerTag || cartLines.length === 0) {
      return false;
    }

    const variantIds = getCartVariantIds(cartLines);

    const { data } = await shopify.query(
      `query UpsellCartTags($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            product {
              tags
            }
          }
        }
      }`,
      { variables: { ids: variantIds } },
    );

    const nodes = data?.nodes ?? [];

    return nodes.some((node) => {
      const tags = node?.product?.tags ?? [];
      return tags.some((tag) => tag.toLowerCase() === triggerTag);
    });
  }

  async function handleAddToCart(variantId) {
    if (!canAddToCart) {
      setShowError(true);
      return;
    }

    setAddingId(variantId);

    try {
      const result = await shopify.applyCartLinesChange({
        type: "addCartLine",
        merchandiseId: variantId,
        quantity: 1,
      });

      if (result.type === "error") {
        setShowError(true);
        console.error(result.message);
      }
    } catch (error) {
      setShowError(true);
      console.error(error);
    } finally {
      setAddingId(null);
    }
  }

  if (!shouldRender) {
    return null;
  }

  if (loading) {
    return (
      <s-box padding="base">
        <s-stack gap="base">
          <s-text type="emphasis">{config.heading}</s-text>
          <s-spinner size="base" />
        </s-stack>
      </s-box>
    );
  }

  if (!products.length) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack gap="base">
          <s-text type="emphasis">{config.heading}</s-text>
          <s-text tone="subdued">
            {shopify.i18n.translate("upsellEmpty")}
          </s-text>
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="large">
        <s-text type="emphasis">{config.heading}</s-text>

        {!canAddToCart && (
          <s-banner tone="warning">
            {shopify.i18n.translate("upsellAddNotSupported")}
          </s-banner>
        )}

        {products.map((product) => (
          <UpsellProductRow
            key={product.id}
            product={product}
            adding={addingId === product.variants.nodes[0]?.id}
            disabled={!canAddToCart || Boolean(addingId)}
            onAdd={handleAddToCart}
          />
        ))}

        {showError && (
          <s-banner tone="critical">
            {shopify.i18n.translate("upsellAddError")}
          </s-banner>
        )}
      </s-stack>
    </s-box>
  );
}

function UpsellProductRow({ product, adding, disabled, onAdd }) {
  const variant = product.variants?.nodes?.[0];
  if (!variant) return null;

  const imageUrl = product.images?.nodes?.[0]?.url ?? PLACEHOLDER_IMAGE;
  const price = shopify.i18n.formatCurrency(variant.price.amount);

  return (
    <s-stack direction="inline" gap="base">
      <s-product-thumbnail src={imageUrl} size="base" />
      <s-stack gap="small">
        <s-text type="emphasis">{product.title}</s-text>
        <s-text tone="subdued">{price}</s-text>
        <s-button
          variant="secondary"
          loading={adding}
          disabled={disabled}
          onClick={() => onAdd(variant.id)}
        >
          {shopify.i18n.translate("upsellAddButton")}
        </s-button>
      </s-stack>
    </s-stack>
  );
}
