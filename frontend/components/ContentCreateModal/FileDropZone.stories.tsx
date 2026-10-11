import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent } from "storybook/test";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { placeholderImage } from "@/stories/fixtures";
import FileDropZone, { type Attachment } from "./FileDropZone";

type Props = React.ComponentProps<typeof FileDropZone>;

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Keeps images and documents in story state so remove/reorder work. */
function Stateful(props: Props) {
  const [images, setImages] = useState<Attachment[]>(props.images);
  const [documents, setDocuments] = useState<Attachment[]>(props.documents);
  return (
    <FileDropZone
      {...props}
      images={images}
      documents={documents}
      onAddImages={(a) => setImages((p) => [...p, ...a])}
      onRemoveImage={(url) => setImages((p) => p.filter((x) => x.url !== url))}
      onReorderImages={(f, t) => setImages((p) => move(p, f, t))}
      onAddDocuments={(a) => setDocuments((p) => [...p, ...a])}
      onRemoveDocument={(url) => setDocuments((p) => p.filter((x) => x.url !== url))}
      onReorderDocuments={(f, t) => setDocuments((p) => move(p, f, t))}
    />
  );
}

const images: Attachment[] = [
  { name: "ratleikur-kort.png", url: placeholderImage("Kort", 177), content_type: "image/png" },
  { name: "stod-3.png", url: placeholderImage("Stöð 3", 30), content_type: "image/png" },
  { name: "verdlaun.png", url: placeholderImage("Verðlaun", 270), content_type: "image/png" },
];

const documents: Attachment[] = [
  { name: "Þrautablað.pdf", url: "#thrautablad", content_type: "application/pdf" },
  {
    name: "Svarblað fyrir foringja.docx",
    url: "#svarblad",
    content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
];

const meta = {
  title: "Components/Búa til/FileDropZone",
  component: FileDropZone,
  render: (args) => <Stateful {...args} />,
  args: {
    images: [],
    documents: [],
    onAddImages: fn(),
    onRemoveImage: fn(),
    onReorderImages: fn(),
    onAddDocuments: fn(),
    onRemoveDocument: fn(),
    onReorderDocuments: fn(),
    onPreviewDocument: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 680 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Uploads go to Azure through a SAS URL. In Storybook the SAS request never succeeds " +
          "(it is held or refused by the fetch mock), so no file ever leaves the browser.",
      },
    },
  },
} satisfies Meta<typeof FileDropZone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithFiles: Story = { args: { images, documents } };

export const WithoutPreview: Story = {
  args: { images, documents, onPreviewDocument: undefined },
};

const user = userEvent.setup({ applyAccept: false });

async function pick(canvasElement: HTMLElement, file: File) {
  const input = canvasElement.querySelector<HTMLInputElement>("#drop-input");
  if (input) await user.upload(input, file);
}

export const UnsupportedFile: Story = {
  play: async ({ canvasElement }) => {
    await pick(
      canvasElement,
      new File(["MZ"], "uppsetning.exe", { type: "application/x-msdownload" })
    );
  },
};

export const Uploading: Story = {
  parameters: {
    mockApi: [{ match: /\/uploads\/sas/, delay: Infinity }] satisfies MockRoute[],
  },
  play: async ({ canvasElement }) => {
    await pick(canvasElement, new File(["png"], "hopmynd.png", { type: "image/png" }));
  },
};

export const UploadFailed: Story = {
  parameters: {
    // The failed request is logged by the app on purpose; nothing else may log.
    allowedConsoleErrors: [/^\[API 500\]/],
    mockApi: [
      { match: /\/uploads\/sas/, status: 500, body: { detail: "Geymslan svarar ekki" } },
    ] satisfies MockRoute[],
  },
  play: async ({ canvasElement }) => {
    await pick(canvasElement, new File(["%PDF"], "Þrautablað.pdf", { type: "application/pdf" }));
  },
};
