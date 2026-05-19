import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/Upsell.jsx' {
  const shopify:
    | import('@shopify/ui-extensions/purchase.checkout.block.render').Api
    | import('@shopify/ui-extensions/purchase.checkout.cart-line-list.render-after').Api
    | import('@shopify/ui-extensions/purchase.checkout.reductions.render-before').Api
    | import('@shopify/ui-extensions/purchase.checkout.footer.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/UpsellOffers.jsx' {
  const shopify:
    | import('@shopify/ui-extensions/purchase.checkout.block.render').Api
    | import('@shopify/ui-extensions/purchase.checkout.cart-line-list.render-after').Api
    | import('@shopify/ui-extensions/purchase.checkout.reductions.render-before').Api
    | import('@shopify/ui-extensions/purchase.checkout.footer.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}
