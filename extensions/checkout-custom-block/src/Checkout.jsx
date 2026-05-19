import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import {
  UpsellOffers,
  UPSELL_BLOCK_PLACEMENT,
} from "./UpsellOffers.jsx";

const SHOP_MESSAGE_KEY = "checkout_block_text";
const COMMENT_LABEL_KEY = "order_comment_label";
const COMMENT_HELP_KEY = "order_comment_help";
const DEFAULT_SHOP_MESSAGE = "Thank you for shopping with us!";

/** @typedef {'empty' | 'saved' | 'error'} FeedbackType */

export default async () => {
  render(<Extension />, document.body);
};

function findShopMetafield(key) {
  const entry = shopify.appMetafields.value.find(
    (item) =>
      item.target.type === "shop" &&
      item.metafield.namespace === "$app" &&
      item.metafield.key === key,
  );

  return entry?.metafield?.value?.trim() || "";
}

function findShopMessage() {
  return findShopMetafield(SHOP_MESSAGE_KEY) || DEFAULT_SHOP_MESSAGE;
}

function Extension() {
  const canUpdateNote = shopify.instructions.value.notes.canUpdateNote;
  const shopMessage = findShopMessage();

  const checkoutNote = shopify.note.value?.trim() || "";

  const [commentDraft, setCommentDraft] = useState(checkoutNote);
  const [clickCount, setClickCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  /** @type {[FeedbackType | null, Function]} */
  const [feedbackType, setFeedbackType] = useState(null);
  const [feedbackDetail, setFeedbackDetail] = useState("");

  useEffect(() => {
    setCommentDraft(checkoutNote);
    setFeedbackType(null);
    setFeedbackDetail("");
  }, [checkoutNote]);

  function handleDraftChange(value) {
    setCommentDraft(value);
    if (value.trim() && feedbackType === "empty") {
      setFeedbackType(null);
      setFeedbackDetail("");
    }
  }

  async function handleSaveComment() {
    const value = commentDraft.trim();

    if (!value) {
      setFeedbackType("empty");
      setFeedbackDetail("");
      return;
    }

    if (!canUpdateNote) {
      setFeedbackType("error");
      setFeedbackDetail(shopify.i18n.translate("noteNotSupported"));
      return;
    }

    setIsSaving(true);
    setFeedbackType(null);
    setFeedbackDetail("");

    try {
      const result = await shopify.applyNoteChange({
        type: "updateNote",
        note: value,
      });

      if (result.type === "error") {
        setFeedbackType("error");
        setFeedbackDetail(
          result.message || shopify.i18n.translate("saveFailed"),
        );
        return;
      }

      setFeedbackType("saved");
      setFeedbackDetail("");
    } catch (error) {
      setFeedbackType("error");
      setFeedbackDetail(
        error instanceof Error
          ? error.message
          : shopify.i18n.translate("saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearComment() {
    if (!canUpdateNote) return;

    setIsSaving(true);
    setFeedbackType(null);
    setFeedbackDetail("");

    try {
      await shopify.applyNoteChange({ type: "removeNote" });
      setCommentDraft("");
    } catch (error) {
      setFeedbackType("error");
      setFeedbackDetail(
        error instanceof Error
          ? error.message
          : shopify.i18n.translate("saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleClickCount() {
    setClickCount((count) => count + 1);
  }

  const commentLabel =
    findShopMetafield(COMMENT_LABEL_KEY) ||
    shopify.i18n.translate("orderCommentLabel");
  const commentHelp = findShopMetafield(COMMENT_HELP_KEY);

  const emptyCommentMessage = shopify.i18n.translate("commentEmpty");
  const savedNote = shopify.note.value?.trim() || "";

  // Never treat validation copy as a saved order note (can happen from stale data).
  const isValidSavedNote =
    Boolean(savedNote) && savedNote !== emptyCommentMessage;

  const showEmptyError = feedbackType === "empty" && !commentDraft.trim();
  const showSavedConfirmation = feedbackType === "saved";
  const showErrorDetail = feedbackType === "error" && Boolean(feedbackDetail);

  return (
    <>
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="large">
        <s-stack gap="base">
          <s-text type="emphasis">
            {shopify.i18n.translate("heading")}
          </s-text>
          <s-text>{shopMessage}</s-text>
        </s-stack>

        <s-divider direction="inline" />

        <s-stack gap="base">
          <s-text type="emphasis">{commentLabel}</s-text>
          {commentHelp && <s-text tone="subdued">{commentHelp}</s-text>}

          {!canUpdateNote && (
            <s-banner tone="warning">
              {shopify.i18n.translate("noteNotSupported")}
            </s-banner>
          )}

          <s-text-area
            label={commentLabel}
            value={commentDraft}
            onInput={(event) => handleDraftChange(event.currentTarget.value)}
            onChange={(event) => handleDraftChange(event.currentTarget.value)}
            rows={3}
            disabled={!canUpdateNote || isSaving}
          />

          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              onClick={handleSaveComment}
              disabled={!canUpdateNote || isSaving}
            >
              {shopify.i18n.translate("saveComment")}
            </s-button>
            <s-button variant="secondary" onClick={handleClickCount}>
              {shopify.i18n.translate("clickToCount")}
            </s-button>
            {isValidSavedNote && (
              <s-button
                variant="secondary"
                onClick={handleClearComment}
                disabled={!canUpdateNote || isSaving}
              >
                {shopify.i18n.translate("clearComment")}
              </s-button>
            )}
          </s-stack>

          {clickCount > 0 && (
            <s-text tone="subdued">
              {shopify.i18n.translate("clickCount", {
                count: String(clickCount),
              })}
            </s-text>
          )}

          {showEmptyError && (
            <s-text tone="critical">{emptyCommentMessage}</s-text>
          )}

          {showSavedConfirmation && (
            <s-text tone="success">
              {shopify.i18n.translate("commentSaved")}
            </s-text>
          )}

          {showErrorDetail && <s-text tone="critical">{feedbackDetail}</s-text>}

          {isValidSavedNote && (
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="small">
                <s-text type="emphasis">
                  {shopify.i18n.translate("savedComment")}
                </s-text>
                <s-text>{savedNote}</s-text>
              </s-stack>
            </s-box>
          )}
        </s-stack>
      </s-stack>
    </s-box>
    <UpsellOffers embeddedInMainBlock />
    </>
  );
}
