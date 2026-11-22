import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import DocumentViewer, { type ViewableDocument } from "./DocumentViewer";

/**
 * The viewer asks the backend for a signed download URL, then fetches the
 * bytes. Both steps stay inside Storybook: the signed-URL request is mocked and
 * points at a static file, so nothing leaves the browser.
 */

// documentBlobName() only accepts the real blob path shape.
const BLOB =
  "https://slodiblobstorage.blob.core.windows.net/documents/uploads/documents/" +
  "3f1c2a4e-1111-4a2b-9c3d-1234567890ab/7d9e0f12-2222-4b3c-8d4e-abcdef012345";

const doc = (name: string, content_type: string): ViewableDocument => ({
  name,
  url: BLOB,
  content_type,
});

function signed(downloadUrl: string): MockRoute[] {
  return [
    {
      match: /\/uploads\/sas\/download/,
      method: "POST",
      body: { download_url: downloadUrl, expires_at: "2026-10-11T12:00:00Z" },
    },
  ];
}

// The signed URLs point at files Storybook already serves from `public/`.
// (`data:` URLs would be neater, but the mock fetch only lets same-origin
// requests through.)
const textUrl = "/TODO-icons.md";
const imageUrl = "/apple-touch-icon.png";
const unsupportedUrl = "/site.webmanifest";

const meta = {
  title: "Components/Sameiginlegt/DocumentViewer",
  component: DocumentViewer,
  args: {
    open: true,
    onClose: fn(),
    doc: doc("Þrautablað.md", "text/markdown"),
  },
  parameters: {
    layout: "fullscreen",
    mockApi: signed(textUrl),
    docs: { story: { inline: false, height: "560px" } },
  },
} satisfies Meta<typeof DocumentViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextDocument: Story = {};

export const Image: Story = {
  args: { doc: doc("Merki-Slóða.png", "image/png") },
  parameters: { mockApi: signed(imageUrl) },
};

export const Pdf: Story = {
  args: { doc: doc("Þrautablað.pdf", "application/pdf") },
  parameters: {
    mockApi: [
      ...signed("/sb-download/thrautablad.pdf"),
      {
        match: /^\/sb-download\//,
        body: "%PDF-1.4 (Storybook placeholder)",
        headers: { "Content-Type": "application/pdf" },
      },
    ] satisfies MockRoute[],
    docs: {
      description: {
        story:
          "The bytes are a placeholder, not a real PDF, so the browser's PDF frame may show " +
          "an empty or broken document — the story is for the surrounding chrome.",
      },
    },
  },
};

export const Unsupported: Story = {
  args: { doc: doc("Leiðbeiningar.docx", "application/vnd.openxmlformats") },
  parameters: { mockApi: signed(unsupportedUrl) },
};

export const Loading: Story = {
  parameters: {
    mockApi: [{ match: /\/uploads\/sas\/download/, delay: Infinity }] satisfies MockRoute[],
  },
};

export const ErrorState: Story = {
  name: "Error",
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { match: /\/uploads\/sas\/download/, status: 500, body: { detail: "Skjalið fannst ekki." } },
    ] satisfies MockRoute[],
  },
};

export const InvalidUrl: Story = {
  args: { doc: { name: "gamalt-skjal.pdf", url: "https://example.invalid/skjal.pdf" } },
};

export const LongFileName: Story = {
  args: {
    doc: doc(
      "Leiðbeiningar fyrir næturgöngu um Heiðmörk með vasaljósum og stjörnuskoðun — lokaútgáfa (3).md",
      "text/markdown"
    ),
  },
};
