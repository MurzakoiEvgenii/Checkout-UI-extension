import { useState, useCallback, useRef } from "react";
import {
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Select,
  Banner,
  Divider,
  Box,
  Thumbnail,
  Checkbox,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// ─── Checkout colour scheme definitions ───────────────────────────────────────

export type SchemeId = "classic" | "dark" | "warm" | "neon";

type CornerRadius = "NONE" | "SMALL" | "BASE" | "LARGE";
type HeaderPosition = "INLINE" | "START";

interface ColorRole {
  background: string;
  text: string;
}

interface SchemeColors {
  base: ColorRole;
  primaryButton: ColorRole;
  secondaryButton: ColorRole;
  control: ColorRole;
}

interface Scheme {
  id: SchemeId;
  name: string;
  description: string;
  swatches: string[];
  // scheme1 = main body, scheme2 = order summary, scheme3 = header
  scheme1: SchemeColors;
  scheme2: SchemeColors;
  scheme3: SchemeColors;
  cornerRadiusBase: number;
  cornerRadiusSmall: number;
  cornerRadiusLarge: number;
  globalCornerRadius: CornerRadius;
  primaryButtonCornerRadius: CornerRadius;
}

export const SCHEMES: Scheme[] = [
  {
    id: "classic",
    name: "Classic Clean",
    description: "Clean, light look. Blue buttons, soft rounded corners.",
    swatches: ["#FFFFFF", "#F5F5F5", "#2563EB", "#F0F0F0"],
    scheme1: {
      base: { background: "#FFFFFF", text: "#1A1A1A" },
      primaryButton: { background: "#2563EB", text: "#FFFFFF" },
      secondaryButton: { background: "#F0F0F0", text: "#333333" },
      control: { background: "#FFFFFF", text: "#1A1A1A" },
    },
    scheme2: {
      base: { background: "#F5F5F5", text: "#1A1A1A" },
      primaryButton: { background: "#2563EB", text: "#FFFFFF" },
      secondaryButton: { background: "#E5E5E5", text: "#333333" },
      control: { background: "#F5F5F5", text: "#1A1A1A" },
    },
    scheme3: {
      base: { background: "#FFFFFF", text: "#1A1A1A" },
      primaryButton: { background: "#2563EB", text: "#FFFFFF" },
      secondaryButton: { background: "#F0F0F0", text: "#333333" },
      control: { background: "#FFFFFF", text: "#1A1A1A" },
    },
    cornerRadiusBase: 4,
    cornerRadiusSmall: 2,
    cornerRadiusLarge: 8,
    globalCornerRadius: "BASE",
    primaryButtonCornerRadius: "BASE",
  },
  {
    id: "dark",
    name: "Dark Luxe",
    description: "Dark background, purple accents. Sharp corners, premium feel.",
    swatches: ["#1A1A2E", "#16213E", "#7C3AED", "#0D0D0D"],
    scheme1: {
      base: { background: "#1A1A2E", text: "#E0E0E0" },
      primaryButton: { background: "#7C3AED", text: "#FFFFFF" },
      secondaryButton: { background: "#0F3460", text: "#E0E0E0" },
      control: { background: "#16213E", text: "#E0E0E0" },
    },
    scheme2: {
      base: { background: "#16213E", text: "#C0C0C0" },
      primaryButton: { background: "#7C3AED", text: "#FFFFFF" },
      secondaryButton: { background: "#0F3460", text: "#C0C0C0" },
      control: { background: "#1A1A2E", text: "#C0C0C0" },
    },
    scheme3: {
      base: { background: "#0D0D0D", text: "#FFFFFF" },
      primaryButton: { background: "#7C3AED", text: "#FFFFFF" },
      secondaryButton: { background: "#1A1A2E", text: "#E0E0E0" },
      control: { background: "#0D0D0D", text: "#FFFFFF" },
    },
    cornerRadiusBase: 0,
    cornerRadiusSmall: 0,
    cornerRadiusLarge: 0,
    globalCornerRadius: "NONE",
    primaryButtonCornerRadius: "NONE",
  },
  {
    id: "warm",
    name: "Warm Earth",
    description: "Cream tones, terracotta buttons. Cozy organic style.",
    swatches: ["#FDF6EC", "#F0E4D4", "#C44B4B", "#E8D5C4"],
    scheme1: {
      base: { background: "#FDF6EC", text: "#3D2B1F" },
      primaryButton: { background: "#C44B4B", text: "#FFFFFF" },
      secondaryButton: { background: "#E8D5C4", text: "#3D2B1F" },
      control: { background: "#FDF6EC", text: "#3D2B1F" },
    },
    scheme2: {
      base: { background: "#F0E4D4", text: "#3D2B1F" },
      primaryButton: { background: "#C44B4B", text: "#FFFFFF" },
      secondaryButton: { background: "#E8D5C4", text: "#3D2B1F" },
      control: { background: "#F0E4D4", text: "#3D2B1F" },
    },
    scheme3: {
      base: { background: "#FDF6EC", text: "#3D2B1F" },
      primaryButton: { background: "#C44B4B", text: "#FFFFFF" },
      secondaryButton: { background: "#E8D5C4", text: "#3D2B1F" },
      control: { background: "#FDF6EC", text: "#3D2B1F" },
    },
    cornerRadiusBase: 2,
    cornerRadiusSmall: 1,
    cornerRadiusLarge: 4,
    globalCornerRadius: "SMALL",
    primaryButtonCornerRadius: "SMALL",
  },
  {
    id: "neon",
    name: "Bold Neon",
    description: "Black background, neon-green accents. Aggressive tech style.",
    swatches: ["#0A0A0A", "#111111", "#00FF88", "#222222"],
    scheme1: {
      base: { background: "#0A0A0A", text: "#F5F5F5" },
      primaryButton: { background: "#00FF88", text: "#000000" },
      secondaryButton: { background: "#222222", text: "#00FF88" },
      control: { background: "#111111", text: "#F5F5F5" },
    },
    scheme2: {
      base: { background: "#111111", text: "#CCCCCC" },
      primaryButton: { background: "#00FF88", text: "#000000" },
      secondaryButton: { background: "#222222", text: "#00FF88" },
      control: { background: "#0A0A0A", text: "#CCCCCC" },
    },
    scheme3: {
      base: { background: "#000000", text: "#FFFFFF" },
      primaryButton: { background: "#00FF88", text: "#000000" },
      secondaryButton: { background: "#111111", text: "#00FF88" },
      control: { background: "#000000", text: "#FFFFFF" },
    },
    cornerRadiusBase: 0,
    cornerRadiusSmall: 0,
    cornerRadiusLarge: 0,
    globalCornerRadius: "NONE",
    primaryButtonCornerRadius: "NONE",
  },
];

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const CHECKOUT_PROFILES_QUERY = `#graphql
  query CheckoutProfiles {
    checkoutProfiles(first: 10) {
      edges {
        node {
          id
          name
          isPublished
        }
      }
    }
  }
`;

const STAGED_UPLOADS_CREATE_MUTATION = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE_MUTATION = `#graphql
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage { id }
      }
      userErrors { field message }
    }
  }
`;

const FILE_BY_ID_QUERY = `#graphql
  query FileById($id: ID!) {
    node(id: $id) {
      id
      ... on MediaImage { id fileStatus }
    }
  }
`;

const BRANDING_UPSERT_MUTATION = `#graphql
  mutation CheckoutBrandingUpsert(
    $checkoutBrandingInput: CheckoutBrandingInput!
    $checkoutProfileId: ID!
  ) {
    checkoutBrandingUpsert(
      checkoutBrandingInput: $checkoutBrandingInput
      checkoutProfileId: $checkoutProfileId
    ) {
      checkoutBranding {
        designSystem {
          colors {
            schemes {
              scheme1 {
                base { background text }
                primaryButton { background text }
              }
            }
          }
        }
        customizations {
          header {
            position
            logo { image { url } maxWidth }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── Server ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(CHECKOUT_PROFILES_QUERY);
  const json = await res.json();

  const profiles: { id: string; name: string; isPublished: boolean }[] =
    json.data?.checkoutProfiles?.edges?.map(
      (e: { node: { id: string; name: string; isPublished: boolean } }) => e.node,
    ) ?? [];

  return { profiles };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: 5 * 1024 * 1024,
  });
  const formData = await unstable_parseMultipartFormData(request, uploadHandler);

  const profileId = formData.get("profileId") as string;
  const schemeId = formData.get("schemeId") as SchemeId;
  const headerPosition =
    (formData.get("headerPosition") as HeaderPosition) || "START";
  const logoFile = formData.get("logoFile") as File | null;
  const removeLogo = formData.get("removeLogo") === "true";

  const scheme = SCHEMES.find((s) => s.id === schemeId);
  if (!scheme || !profileId) {
    return { success: false, error: "Invalid scheme or profile" };
  }

  // logoAction:
  //  - "upload"  → upload new file and set as logo
  //  - "remove"  → explicitly clear the current store logo
  //  - "ignore"  → don't touch the logo (preserve current state)
  let logoAction: "upload" | "remove" | "ignore" = "ignore";
  let logoMediaImageId: string | null = null;

  if (logoFile && logoFile.size > 0) {
    if (logoFile.type === "image/svg+xml") {
      return {
        success: false,
        error: "SVG logos are not supported. Use PNG, JPG, GIF or WebP.",
      };
    }
    try {
      logoMediaImageId = await uploadLogoFile(admin, logoFile);
      logoAction = "upload";
    } catch (err) {
      return {
        success: false,
        error: `Logo upload failed: ${(err as Error).message}`,
      };
    }
  } else if (removeLogo) {
    logoAction = "remove";
  }

  const input = buildBrandingInput(scheme, {
    headerPosition,
    logoAction,
    logoMediaImageId,
  });

  const res = await admin.graphql(BRANDING_UPSERT_MUTATION, {
    variables: {
      checkoutProfileId: profileId,
      checkoutBrandingInput: input,
    },
  });

  const json = await res.json();
  const userErrors = json.data?.checkoutBrandingUpsert?.userErrors ?? [];

  if (userErrors.length > 0) {
    return {
      success: false,
      error: userErrors.map((e: { message: string }) => e.message).join("; "),
    };
  }

  return {
    success: true,
    appliedScheme: schemeId,
    appliedProfile: profileId,
  };
};

// ─── Logo upload (staged upload + fileCreate) ─────────────────────────────────

async function uploadLogoFile(
  admin: { graphql: (q: string, opts?: { variables: unknown }) => Promise<Response> },
  file: File,
): Promise<string> {
  const stagedRes = await admin.graphql(STAGED_UPLOADS_CREATE_MUTATION, {
    variables: {
      input: [
        {
          filename: file.name,
          mimeType: file.type,
          resource: "FILE",
          httpMethod: "POST",
          fileSize: String(file.size),
        },
      ],
    },
  });
  const stagedJson = await stagedRes.json();
  const stagedErrors = stagedJson.data?.stagedUploadsCreate?.userErrors ?? [];

  if (stagedErrors.length > 0) {
    throw new Error(
      stagedErrors.map((e: { message: string }) => e.message).join("; "),
    );
  }

  const target = stagedJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) throw new Error("No staged upload target returned");

  const uploadForm = new FormData();
  for (const { name, value } of target.parameters as {
    name: string;
    value: string;
  }[]) {
    uploadForm.append(name, value);
  }
  uploadForm.append("file", file);

  const uploadRes = await fetch(target.url, {
    method: "POST",
    body: uploadForm,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload to staging failed: ${uploadRes.statusText}`);
  }

  const fileRes = await admin.graphql(FILE_CREATE_MUTATION, {
    variables: {
      files: [
        {
          contentType: "IMAGE",
          originalSource: target.resourceUrl,
          alt: "Checkout logo",
        },
      ],
    },
  });
  const fileJson = await fileRes.json();
  const fileErrors = fileJson.data?.fileCreate?.userErrors ?? [];

  if (fileErrors.length > 0) {
    throw new Error(
      fileErrors.map((e: { message: string }) => e.message).join("; "),
    );
  }

  const createdFile = fileJson.data?.fileCreate?.files?.[0];
  if (!createdFile?.id) throw new Error("File creation returned no id");

  return await waitForMediaImageReady(admin, createdFile.id);
}

async function waitForMediaImageReady(
  admin: { graphql: (q: string, opts?: { variables: unknown }) => Promise<Response> },
  fileId: string,
): Promise<string> {
  const maxAttempts = 10;
  const delayMs = 500;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await admin.graphql(FILE_BY_ID_QUERY, {
      variables: { id: fileId },
    });
    const json = await res.json();
    const node = json.data?.node;

    if (node?.fileStatus === "READY") return node.id;
    if (node?.fileStatus === "FAILED") {
      throw new Error("Shopify failed to process the uploaded logo");
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error("Logo processing timed out");
}

// ─── Branding input builder ───────────────────────────────────────────────────

function buildBrandingInput(
  scheme: Scheme,
  opts: {
    headerPosition: HeaderPosition;
    logoAction: "upload" | "remove" | "ignore";
    logoMediaImageId: string | null;
  },
) {
  const logoInput =
    opts.logoAction === "upload" && opts.logoMediaImageId
      ? {
          image: { mediaImageId: opts.logoMediaImageId },
          maxWidth: 200,
          visibility: "VISIBLE",
        }
      : opts.logoAction === "remove"
        ? { image: { mediaImageId: null } }
        : null;

  // Shopify requires designSystem.cornerRadius values to be > 0.
  // For "sharp corners" schemes we omit the numeric block and rely on
  // customizations.global.cornerRadius = "NONE" to override visually.
  const hasPositiveRadius =
    scheme.cornerRadiusBase > 0 &&
    scheme.cornerRadiusSmall > 0 &&
    scheme.cornerRadiusLarge > 0;

  return {
    designSystem: {
      colors: {
        schemes: {
          scheme1: {
            base: scheme.scheme1.base,
            primaryButton: scheme.scheme1.primaryButton,
            secondaryButton: scheme.scheme1.secondaryButton,
            control: scheme.scheme1.control,
          },
          scheme2: {
            base: scheme.scheme2.base,
            primaryButton: scheme.scheme2.primaryButton,
            secondaryButton: scheme.scheme2.secondaryButton,
            control: scheme.scheme2.control,
          },
          scheme3: {
            base: scheme.scheme3.base,
            primaryButton: scheme.scheme3.primaryButton,
            secondaryButton: scheme.scheme3.secondaryButton,
            control: scheme.scheme3.control,
          },
        },
      },
      ...(hasPositiveRadius && {
        cornerRadius: {
          base: scheme.cornerRadiusBase,
          small: scheme.cornerRadiusSmall,
          large: scheme.cornerRadiusLarge,
        },
      }),
    },
    customizations: {
      // global.cornerRadius accepts only "NONE" (on/off override).
      // For BASE/SMALL/LARGE we omit it and rely on designSystem.cornerRadius.
      ...(scheme.globalCornerRadius === "NONE" && {
        global: { cornerRadius: "NONE" },
      }),
      header: {
        colorScheme: "COLOR_SCHEME3",
        alignment: "CENTER",
        position: opts.headerPosition,
        ...(logoInput && { logo: logoInput }),
      },
      main: {
        colorScheme: "COLOR_SCHEME1",
      },
      orderSummary: {
        colorScheme: "COLOR_SCHEME2",
      },
      footer: {
        colorScheme: "COLOR_SCHEME1",
        alignment: "CENTER",
      },
      primaryButton: {
        background: "SOLID",
        border: "NONE",
        cornerRadius: scheme.primaryButtonCornerRadius,
      },
      secondaryButton: {
        background: "SOLID",
        border: "FULL",
      },
      control: {
        border: "FULL",
        labelPosition: "OUTSIDE",
      },
    },
  };
}

// ─── UI ───────────────────────────────────────────────────────────────────────

const HEADER_POSITION_OPTIONS: { label: string; value: HeaderPosition }[] = [
  { label: "Top (default)", value: "START" },
  { label: "Left, above form", value: "INLINE" },
];

export default function BrandingPage() {
  const { profiles } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [selectedProfile, setSelectedProfile] = useState(
    profiles[0]?.id ?? "",
  );
  const [selectedScheme, setSelectedScheme] = useState<SchemeId | null>(null);
  const [headerPosition, setHeaderPosition] = useState<HeaderPosition>("START");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  const profileOptions = profiles.map((p) => ({
    label: `${p.name}${p.isPublished ? " (published)" : ""}`,
    value: p.id,
  }));

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setLogoFile(file);
      setLogoPreviewUrl(file ? URL.createObjectURL(file) : null);
      if (file) setRemoveLogo(false);
    },
    [],
  );

  const handleClearLogo = useCallback(() => {
    setLogoFile(null);
    setLogoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleToggleRemoveLogo = useCallback((checked: boolean) => {
    setRemoveLogo(checked);
    if (checked) {
      setLogoFile(null);
      setLogoPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleApply = useCallback(() => {
    if (!selectedScheme || !selectedProfile) return;
    const data = new FormData();
    data.append("profileId", selectedProfile);
    data.append("schemeId", selectedScheme);
    data.append("headerPosition", headerPosition);
    if (logoFile) data.append("logoFile", logoFile);
    if (removeLogo && !logoFile) data.append("removeLogo", "true");

    fetcher.submit(data, {
      method: "POST",
      encType: "multipart/form-data",
    });
  }, [
    selectedScheme,
    selectedProfile,
    headerPosition,
    logoFile,
    removeLogo,
    fetcher,
  ]);

  return (
    <Page>
      <TitleBar title="Checkout Branding" />
      <BlockStack gap="600">
        {result && !isLoading && (
          <Banner
            tone={result.success ? "success" : "critical"}
            onDismiss={() => {}}
          >
            {result.success
              ? "Scheme applied to the checkout profile successfully."
              : `Error: ${"error" in result ? result.error : "Unknown error"}`}
          </Banner>
        )}

        <Layout>
          {/* Left: profile selector + logo + apply */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Checkout profile
                  </Text>
                  {profiles.length === 0 ? (
                    <Banner tone="warning">
                      No checkout profiles found. Make sure the store has a
                      checkout profile (Settings → Checkout).
                    </Banner>
                  ) : (
                    <Select
                      label="Apply scheme to:"
                      options={profileOptions}
                      value={selectedProfile}
                      onChange={setSelectedProfile}
                    />
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Header & logo
                  </Text>

                  <Select
                    label="Header position"
                    options={HEADER_POSITION_OPTIONS}
                    value={headerPosition}
                    onChange={(v) => setHeaderPosition(v as HeaderPosition)}
                    helpText={
                      headerPosition === "INLINE"
                        ? "Logo will sit on the left, beside the form."
                        : "Logo will sit on top, full width."
                    }
                  />

                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      Logo image
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      PNG, JPG, GIF or WebP. SVG is not supported by Shopify
                      checkout branding.
                    </Text>

                    {logoPreviewUrl && (
                      <Box paddingBlockStart="200" paddingBlockEnd="200">
                        <InlineStack gap="300" blockAlign="center">
                          <Thumbnail
                            source={logoPreviewUrl}
                            alt="Logo preview"
                            size="small"
                          />
                          <Text as="span" variant="bodySm">
                            {logoFile?.name}
                          </Text>
                          <Button variant="plain" onClick={handleClearLogo}>
                            Remove
                          </Button>
                        </InlineStack>
                      </Box>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleFileChange}
                      disabled={removeLogo}
                    />

                    <Checkbox
                      label="Remove current logo from checkout"
                      helpText="Clears the existing logo so the store name shows instead."
                      checked={removeLogo}
                      onChange={handleToggleRemoveLogo}
                    />
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Divider />
                  <Button
                    variant="primary"
                    disabled={!selectedScheme || !selectedProfile}
                    loading={isLoading}
                    onClick={handleApply}
                  >
                    Apply scheme
                  </Button>
                  {!selectedScheme && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Pick a scheme on the right, then click Apply.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    All profiles
                  </Text>
                  {profiles.map((p) => (
                    <InlineStack key={p.id} align="space-between">
                      <Text as="span" variant="bodyMd">
                        {p.name}
                      </Text>
                      {p.isPublished ? (
                        <Badge tone="success">Published</Badge>
                      ) : (
                        <Badge>Draft</Badge>
                      )}
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Right: scheme cards */}
          <Layout.Section>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Color schemes
              </Text>
              {SCHEMES.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  isSelected={selectedScheme === scheme.id}
                  onSelect={() =>
                    setSelectedScheme(
                      selectedScheme === scheme.id ? null : scheme.id,
                    )
                  }
                />
              ))}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

// ─── Scheme card component ────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  isSelected,
  onSelect,
}: {
  scheme: Scheme;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        cursor: "pointer",
        outline: isSelected ? "2px solid #2563EB" : "2px solid transparent",
        borderRadius: "8px",
        transition: "outline 0.15s",
      }}
    >
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">
                {scheme.name}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {scheme.description}
              </Text>
            </BlockStack>
            {isSelected && <Badge tone="info">Selected</Badge>}
          </InlineStack>

          <CheckoutPreview scheme={scheme} />

          <InlineStack gap="200">
            {scheme.swatches.map((color) => (
              <ColorSwatch key={color} color={color} />
            ))}
            <Text as="span" variant="bodySm" tone="subdued">
              corners:{" "}
              {scheme.globalCornerRadius === "NONE"
                ? "sharp"
                : scheme.globalCornerRadius.toLowerCase()}
            </Text>
          </InlineStack>
        </BlockStack>
      </Card>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <Box
      width="28px"
      minHeight="28px"
      borderRadius="100"
      borderWidth="025"
      borderColor="border"
      background="bg-surface"
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: color,
          border: "1px solid rgba(0,0,0,0.12)",
        }}
      />
    </Box>
  );
}

function CheckoutPreview({ scheme }: { scheme: Scheme }) {
  const {
    scheme1,
    scheme2,
    scheme3,
    globalCornerRadius,
    primaryButtonCornerRadius,
  } = scheme;

  const radius =
    primaryButtonCornerRadius === "NONE"
      ? 0
      : primaryButtonCornerRadius === "SMALL"
        ? 4
        : primaryButtonCornerRadius === "LARGE"
          ? 16
          : 6;

  const inputRadius =
    globalCornerRadius === "NONE"
      ? 0
      : globalCornerRadius === "SMALL"
        ? 2
        : 3;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: 100,
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.12)",
        fontSize: 10,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: scheme3.base.background,
          color: scheme3.base.text,
          padding: "4px 10px",
          fontSize: 9,
          fontWeight: 600,
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        Store
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        <div
          style={{
            flex: 2,
            background: scheme1.base.background,
            color: scheme1.base.text,
            padding: "6px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              height: 14,
              border: `1px solid ${scheme1.control.text}`,
              borderRadius: inputRadius,
              opacity: 0.4,
            }}
          />
          <div
            style={{
              height: 16,
              background: scheme1.primaryButton.background,
              color: scheme1.primaryButton.text,
              borderRadius: radius,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
            }}
          >
            Pay now
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: scheme2.base.background,
            color: scheme2.base.text,
            padding: "6px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            justifyContent: "center",
            borderLeft: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              height: 5,
              width: "80%",
              background: scheme2.base.text,
              opacity: 0.25,
              borderRadius: 1,
            }}
          />
          <div
            style={{
              height: 5,
              width: "55%",
              background: scheme2.base.text,
              opacity: 0.18,
              borderRadius: 1,
            }}
          />
          <div
            style={{
              height: 5,
              width: "70%",
              background: scheme2.base.text,
              opacity: 0.12,
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}
