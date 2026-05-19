import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { UpsellOffers } from "./UpsellOffers.jsx";

export default async () => {
  render(<UpsellOffers />, document.body);
};
