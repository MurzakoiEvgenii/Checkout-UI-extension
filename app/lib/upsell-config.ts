export const UPSELL_METAFIELD_NAMESPACE = "$app";
export const UPSELL_CONFIG_KEY = "upsell_config";

export const DEFAULT_UPSELL_HEADING = "You might also like";
export const DEFAULT_UPSELL_MAX = 3;

export const UPSELL_MODES = [
  { value: "collection", label: "From collection (exclude items already in cart)" },
  {
    value: "recommendations",
    label: "Shopify recommendations (based on first cart item)",
  },
  {
    value: "cart_tag",
    label: "When cart contains a tagged product → show collection",
  },
] as const;

export type UpsellMode = (typeof UPSELL_MODES)[number]["value"];

export const UPSELL_PLACEMENTS = [
  {
    value: "purchase.checkout.cart-line-list.render-after",
    label: "After cart line items (recommended)",
    editorHint:
      "Order summary → Add block → Upsell offers (or click + under cart in preview)",
  },
  {
    value: "purchase.checkout.block.render",
    label: "Flexible checkout block",
    editorHint:
      "Order summary or Main → Add block → Upsell offers. Or embed below comment via Main block only.",
  },
  {
    value: "purchase.checkout.reductions.render-before",
    label: "Before discounts",
    editorHint: "Order summary → before discount field",
  },
  {
    value: "purchase.checkout.footer.render-after",
    label: "Footer",
    editorHint: "Bottom of checkout page",
  },
] as const;

export type UpsellPlacement = (typeof UPSELL_PLACEMENTS)[number]["value"];

export const DEFAULT_UPSELL_PLACEMENT: UpsellPlacement =
  "purchase.checkout.cart-line-list.render-after";

export type UpsellConfig = {
  enabled: boolean;
  heading: string;
  placement: UpsellPlacement;
  mode: UpsellMode;
  collectionId: string;
  cartTriggerTag: string;
  maxProducts: number;
};

export function defaultUpsellConfig(): UpsellConfig {
  return {
    enabled: false,
    heading: DEFAULT_UPSELL_HEADING,
    placement: DEFAULT_UPSELL_PLACEMENT,
    mode: "collection",
    collectionId: "",
    cartTriggerTag: "",
    maxProducts: DEFAULT_UPSELL_MAX,
  };
}

export function parseUpsellConfig(raw: string | null | undefined): UpsellConfig {
  const defaults = defaultUpsellConfig();

  if (!raw?.trim()) {
    return defaults;
  }

  try {
    const data = JSON.parse(raw) as Partial<UpsellConfig>;
    const maxRaw = Number(data.maxProducts);
    const placement = UPSELL_PLACEMENTS.some((p) => p.value === data.placement)
      ? (data.placement as UpsellPlacement)
      : defaults.placement;
    const mode = UPSELL_MODES.some((m) => m.value === data.mode)
      ? (data.mode as UpsellMode)
      : defaults.mode;

    return {
      enabled: Boolean(data.enabled),
      heading: data.heading?.trim() || defaults.heading,
      placement,
      mode,
      collectionId: data.collectionId ?? "",
      cartTriggerTag: data.cartTriggerTag?.trim() ?? "",
      maxProducts:
        Number.isFinite(maxRaw) && maxRaw > 0
          ? Math.min(maxRaw, 6)
          : defaults.maxProducts,
    };
  } catch {
    return defaults;
  }
}

export function serializeUpsellConfig(config: UpsellConfig): string {
  return JSON.stringify(config);
}

export function placementLabel(target: string) {
  return (
    UPSELL_PLACEMENTS.find((p) => p.value === target)?.label ?? target
  );
}

export function placementEditorHint(target: string) {
  return (
    UPSELL_PLACEMENTS.find((p) => p.value === target)?.editorHint ?? ""
  );
}
