import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Bench, FUNDUR, LiveEditor, benchData } from "@/stories/vinnubekkur/benchHarness";
import LidurEditorLab, {
  type LabFundur,
  type LabOtherFundur,
  type LidurEditorLook,
} from "./LidurEditorLab";

/**
 * Variations on LidurEditor, the editor for one liður on the bench. Four directions:
 * A · Inline, B · Side inspector, C · Bottom sheet, D · Quick edit. The usage note and the
 * reasoning behind each direction are on this lab's Docs page. See Lab → About the lab.
 */

/* ── Fixtures: one fundur this week, with a fixed date so the stories do not move ── */

const FUNDUR_ARNA: LabFundur = {
  id: "lab-fundur-arna",
  title: "Flokksfundur Arna",
  dateLabel: "14. október",
  startsAt: "19:30",
  plannedMinutes: 90,
  venue: "Skátaheimilið",
  items: [
    {
      id: "l1",
      name: "Fánastund og hróp",
      kind: "setning",
      minutes: 10,
      status: "confirmed",
      venue: null,
    },
    {
      id: "l2",
      name: "Áttavitinn: undirstöður",
      kind: "dagskra",
      minutes: 30,
      status: "confirmed",
      venue: null,
    },
    {
      id: "l3",
      name: "Kortalestur í hverfinu",
      kind: "dagskra",
      minutes: 35,
      status: "draft",
      venue: "Skólalóðin við Álfhólsveg",
    },
    {
      id: "l4",
      name: "Kötturinn og músin",
      kind: "leikur",
      minutes: 15,
      status: "draft",
      venue: null,
      endurmat: {
        text: "Of stuttur síðast. Krakkarnir voru rétt komin af stað þegar við hættum og vildu spila aftur.",
        by: "Signý Hrund",
        at: "2026-09-23",
        suggestMinutes: 20,
      },
    },
    {
      id: "l5",
      name: "Slit og tilkynningar",
      kind: "slit",
      minutes: 10,
      status: "unknown",
      venue: null,
    },
  ],
};

/** The same fundur with long Icelandic names, to test wrapping. */
const FUNDUR_LONG: LabFundur = {
  ...FUNDUR_ARNA,
  title: "Undirbúningsfundur flokksforingjaráðs vegna landsmótsþátttöku",
  venue: "Skátamiðstöðin í Hraunbæjarhverfinu",
  items: FUNDUR_ARNA.items.map((item) =>
    item.id === "l3"
      ? {
          ...item,
          name: "Endurlífgunaræfingar með æfingabrúðum og sáraumbúðaþjálfun í litlum hópum",
          venue: "Íþróttahús Menntaskólans við Hamrahlíð, salur B",
          endurmat: {
            text: "Krakkarnir vildu meiri tíma með brúðunum. Skiptum hópnum í tvennt næst og höfum sjúkrakassann tilbúinn áður en fundurinn byrjar.",
            by: "Guðmundur Ari Sigurjónsson",
            at: "2026-03-11",
            suggestMinutes: 45,
          },
        }
      : item
  ),
};

const OTHER_FUNDIR: LabOtherFundur[] = [
  { id: "lab-fundur-ugla", title: "Flokksfundur Ugla", dateLabel: "21. október" },
  { id: "lab-fundur-utilega", title: "Haustútilega á Úlfljótsvatni", dateLabel: "23. október" },
  { id: "lab-fundur-bjarna", title: "Flokksfundur Bjarna", dateLabel: "4. nóvember" },
];

/* ── Meta ── */

const LOOK_OPTIONS: LidurEditorLook[] = ["inline", "inspector", "sheet", "quick"];

const meta = {
  title: "Lab/LidurEditor",
  component: LidurEditorLab,
  tags: ["skip-visual"],
  args: {
    look: "inline",
    fundur: FUNDUR_ARNA,
    otherFundir: OTHER_FUNDIR,
    onEvent: fn(),
  },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_OPTIONS },
    defaultEditingId: {
      control: "select",
      options: [undefined, ...FUNDUR_ARNA.items.map((i) => i.id)],
    },
    fundur: { control: false },
    otherFundir: { control: false },
  },
} satisfies Meta<typeof LidurEditorLab>;

export default meta;
type Story = StoryObj<typeof meta>;

const LOOKS: { look: LidurEditorLook; name: string; idea: string }[] = [
  {
    look: "inline",
    name: "A · Inline",
    idea: "Opens under its row. Heiti, then lengd and staða on one line; tegund, staðsetning, færa and afrita wait under “Meira”.",
  },
  {
    look: "inspector",
    name: "B · Side inspector",
    idea: "A panel beside the sheet that follows the liður you click, with ‹ › to walk the fundur. A bottom sheet below 900px.",
  },
  {
    look: "sheet",
    name: "C · Bottom sheet",
    idea: "A sheet from the bottom with big targets: lengd as chips (5–30) plus a stepper, staða as a 2×2 segmented control.",
  },
  {
    look: "quick",
    name: "D · Quick edit",
    idea: "No form for the frequent edits: − / + and the staða menu sit on the row. The editor holds only heiti and the rare fields.",
  },
];

const heading = {
  margin: "0 0 var(--sl-spacing-xs)",
  font: "var(--sl-font-weight-semibold) var(--sl-text-body-sm) var(--sl-font-family-body)",
} as const;
const idea = {
  margin: "0 0 var(--sl-spacing-sm)",
  color: "hsl(var(--sl-color-text-secondary))",
  fontSize: "var(--sl-text-body-sm)",
} as const;
const wide = { maxWidth: "64rem" } as const;
const phone = { viewport: { value: "phone", isRotated: false } };
const dark = { theme: "dark" };

/** Today's editor first, then each direction, all open on the liður that has endurmat. */
export const Comparison: Story = {
  name: "Comparison",
  render: (args) => (
    <div style={{ ...wide, display: "grid", gap: "var(--sl-spacing-xl)" }}>
      <section>
        <h3 style={heading}>Current</h3>
        <p style={idea}>
          What the app uses today, on its own fixture: every field writes straight through, so
          Escape closes and nothing can be discarded.
        </p>
        <Bench data={benchData()} intents={[{ t: "edit", id: "mock-lidur-4-2" }]}>
          <LiveEditor fundurId={FUNDUR.utilega} lidurId="mock-lidur-4-2" />
        </Bench>
      </section>
      {LOOKS.map((l) => (
        <section key={l.look}>
          <h3 style={heading}>{l.name}</h3>
          <p style={idea}>{l.idea}</p>
          <LidurEditorLab {...args} look={l.look} defaultEditingId="l4" contained />
        </section>
      ))}
    </div>
  ),
};

/* ── Play helpers ── */

type Canvas = ReturnType<typeof within>;

function rowButton(canvasElement: HTMLElement, id: string): HTMLElement {
  const button = canvasElement.querySelector<HTMLElement>(`[data-lab-open="${id}"]`);
  if (!button) throw new Error(`No row ${id}`);
  return button;
}

/** "Meira" holds the rare fields in A and C; open it when it is there. */
async function openMeira(canvas: Canvas) {
  const meira = canvas.queryByRole("button", { name: /^Meira/ });
  if (meira && meira.getAttribute("aria-expanded") === "false") await userEvent.click(meira);
}

/**
 * Open from the row, check focus is on Heiti and that Enter there does not close anything,
 * change lengd and staða, press Escape, answer the discard question, and check focus is
 * back on the row.
 */
async function editLengdAndStadaThenEscape(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const row = rowButton(canvasElement, "l2");
  await userEvent.click(row);
  const heiti = await canvas.findByLabelText("Heiti");
  await waitFor(() => expect(heiti).toHaveFocus());
  await userEvent.keyboard("{Enter}");
  await expect(canvas.getByLabelText("Heiti")).toBeInTheDocument();

  await userEvent.click(canvas.getByRole("button", { name: "Lengja um 5 mínútur" }));
  await expect(canvas.getByLabelText("Lengd í mínútum")).toHaveValue(35);
  await userEvent.click(canvas.getByRole("radio", { name: "Óvíst" }));
  await expect(canvas.getByRole("radio", { name: "Óvíst" })).toBeChecked();

  await userEvent.keyboard("{Escape}");
  const question = await canvas.findByRole("alertdialog", { name: "Henda breytingum?" });
  await expect(question).toHaveTextContent("lengd og stöðu");
  await waitFor(() =>
    expect(within(question).getByRole("button", { name: "Halda áfram að breyta" })).toHaveFocus()
  );

  // Escape closes only the question; the edits are still there.
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(canvas.queryByRole("alertdialog")).not.toBeInTheDocument());
  await expect(canvas.getByLabelText("Lengd í mínútum")).toHaveValue(35);

  await userEvent.keyboard("{Escape}");
  await userEvent.click(
    within(await canvas.findByRole("alertdialog")).getByRole("button", { name: "Henda breytingum" })
  );
  await waitFor(() => expect(canvas.queryByLabelText("Heiti")).not.toBeInTheDocument());
  await waitFor(() => expect(rowButton(canvasElement, "l2")).toHaveFocus());
  await expect(rowButton(canvasElement, "l2")).toHaveTextContent("Staðfest");
}

/** D: lengd and staða on the row, then the full editor for the rest. */
async function quickEditThenEscape(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(
    canvas.getByRole("button", { name: "Lengja Kortalestur í hverfinu um 5 mínútur" })
  );
  await expect(canvas.getByLabelText("Lengd Kortalestur í hverfinu í mínútum")).toHaveValue(40);

  const pill = canvas.getByRole("button", { name: "Staða Kortalestur í hverfinu: Drög" });
  await userEvent.click(pill);
  const menu = await canvas.findByRole("menu", { name: "Staða Kortalestur í hverfinu" });
  await waitFor(() =>
    expect(within(menu).getByRole("menuitemradio", { name: "Drög" })).toHaveFocus()
  );
  await userEvent.keyboard("{ArrowUp}{Enter}");
  await waitFor(() => expect(canvas.queryByRole("menu")).not.toBeInTheDocument());
  const changed = canvas.getByRole("button", { name: "Staða Kortalestur í hverfinu: Óvíst" });
  await expect(changed).toHaveFocus();

  // Escape closes the menu without changing anything, and focus goes back to the pill.
  await userEvent.click(changed);
  await canvas.findByRole("menu");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(canvas.queryByRole("menu")).not.toBeInTheDocument());
  await expect(changed).toHaveFocus();

  // The full editor: focus on Heiti, Enter does nothing, Escape closes back to the row.
  await userEvent.click(rowButton(canvasElement, "l3"));
  await waitFor(() => expect(canvas.getByLabelText("Heiti")).toHaveFocus());
  await userEvent.keyboard("{Enter}");
  await expect(canvas.getByLabelText("Heiti")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(canvas.queryByLabelText("Heiti")).not.toBeInTheDocument());
  await waitFor(() => expect(rowButton(canvasElement, "l3")).toHaveFocus());
}

/** Change something, then Escape: the question is left on screen. */
async function leaveUnsaved(canvasElement: HTMLElement, look: LidurEditorLook) {
  const canvas = within(canvasElement);
  await userEvent.click(rowButton(canvasElement, "l2"));
  await waitFor(() => expect(canvas.getByLabelText("Heiti")).toHaveFocus());
  if (look === "quick") {
    // A rare field: in D, lengd and staða are not in the editor at all.
    await userEvent.selectOptions(canvas.getByLabelText("Tegund liðar"), "leikur");
  } else {
    await userEvent.click(canvas.getByRole("button", { name: "Lengja um 5 mínútur" }));
    await userEvent.click(canvas.getByRole("radio", { name: "Óvíst" }));
  }
  await userEvent.keyboard("{Escape}");
  const question = await canvas.findByRole("alertdialog", { name: "Henda breytingum?" });
  await expect(question).toHaveTextContent(look === "quick" ? "tegund" : "lengd og stöðu");
}

/* ── One set of stories per direction ── */

function storiesFor(look: LidurEditorLook, name: string) {
  const render: Story["render"] = (args) => (
    <div style={wide}>
      <LidurEditorLab {...args} />
    </div>
  );
  return {
    base: { name, args: { look, defaultEditingId: "l2" }, render } satisfies Story,
    endurmat: {
      name: `${name} — with endurmat`,
      args: { look, defaultEditingId: "l4" },
      render,
      play: async ({ canvasElement }) => {
        const note = within(canvasElement).getByRole("note", {
          name: "Endurmat frá síðast",
        });
        await expect(note).toHaveTextContent("Signý Hrund · 23. september 2026");
      },
    } satisfies Story,
    longTitle: {
      name: `${name} — long title`,
      args: { look, fundur: FUNDUR_LONG, defaultEditingId: "l3" },
      render,
    } satisfies Story,
    unsaved: {
      name: `${name} — unsaved, then Escape`,
      args: { look },
      render,
      play: async ({ canvasElement }) => leaveUnsaved(canvasElement, look),
    } satisfies Story,
    noOther: {
      name: `${name} — no other fundur`,
      args: { look, otherFundir: [], defaultEditingId: "l2" },
      render,
      play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        await openMeira(canvas);
        await expect(canvas.getByLabelText("Færa í annan fund")).toBeDisabled();
        // waitFor: the editor fades in, and toBeVisible counts opacity.
        await waitFor(() =>
          expect(canvas.getByText("Enginn annar fundur er á bekknum.")).toBeVisible()
        );
      },
    } satisfies Story,
    phone: {
      name: `${name} — phone`,
      args: { look, defaultEditingId: look === "quick" ? undefined : "l4" },
      globals: phone,
      render,
    } satisfies Story,
    dark: {
      name: `${name} — dark`,
      args: { look, defaultEditingId: "l4" },
      globals: dark,
      render,
    } satisfies Story,
    keyboard: {
      name: `${name} — edit, Escape, focus back`,
      args: { look },
      render,
      play: async ({ canvasElement }) =>
        look === "quick"
          ? quickEditThenEscape(canvasElement)
          : editLengdAndStadaThenEscape(canvasElement),
    } satisfies Story,
  };
}

const inline = storiesFor("inline", "A · Inline");
export const Inline: Story = inline.base;
export const InlineEndurmat: Story = inline.endurmat;
export const InlineLongTitle: Story = inline.longTitle;
export const InlineUnsaved: Story = inline.unsaved;
export const InlineNoOtherFundur: Story = inline.noOther;
export const InlinePhone: Story = inline.phone;
export const InlineDark: Story = inline.dark;
export const InlineKeyboard: Story = inline.keyboard;

const inspector = storiesFor("inspector", "B · Side inspector");
export const Inspector: Story = inspector.base;
export const InspectorEndurmat: Story = inspector.endurmat;
export const InspectorLongTitle: Story = inspector.longTitle;
export const InspectorUnsaved: Story = inspector.unsaved;
export const InspectorNoOtherFundur: Story = inspector.noOther;
export const InspectorPhone: Story = inspector.phone;
export const InspectorDark: Story = inspector.dark;
export const InspectorKeyboard: Story = inspector.keyboard;

/**
 * B only: the panel follows the click, and what you typed travels with you. Switching to
 * another liður saves the draft rather than dropping it. Side by side only: below 900px the
 * panel is modal and the rows behind it can't be clicked.
 */
export const InspectorFollowsSelection: Story = {
  name: "B · Side inspector — follows the selection",
  args: { look: "inspector" },
  render: inspector.base.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(rowButton(canvasElement, "l2"));
    const heiti = await canvas.findByLabelText("Heiti");
    if (heiti.closest('[role="dialog"]')) return;
    await userEvent.type(heiti, " og kort");
    await userEvent.click(rowButton(canvasElement, "l4"));
    await expect(rowButton(canvasElement, "l4")).toHaveFocus();
    await expect(canvas.getByLabelText("Heiti")).toHaveValue("Kötturinn og músin");
    await expect(rowButton(canvasElement, "l2")).toHaveTextContent(
      "Áttavitinn: undirstöður og kort"
    );
    await userEvent.click(canvas.getByRole("button", { name: "Fyrri liður" }));
    await expect(canvas.getByLabelText("Heiti")).toHaveValue("Kortalestur í hverfinu");
  },
};

const sheet = storiesFor("sheet", "C · Bottom sheet");
export const Sheet: Story = sheet.base;
export const SheetEndurmat: Story = sheet.endurmat;
export const SheetLongTitle: Story = sheet.longTitle;
export const SheetUnsaved: Story = sheet.unsaved;
export const SheetNoOtherFundur: Story = sheet.noOther;
export const SheetPhone: Story = sheet.phone;
export const SheetDark: Story = sheet.dark;
export const SheetKeyboard: Story = sheet.keyboard;

const quick = storiesFor("quick", "D · Quick edit");
export const Quick: Story = quick.base;
export const QuickEndurmat: Story = quick.endurmat;
export const QuickLongTitle: Story = quick.longTitle;
export const QuickUnsaved: Story = quick.unsaved;
export const QuickNoOtherFundur: Story = quick.noOther;
export const QuickPhone: Story = quick.phone;
export const QuickDark: Story = quick.dark;
export const QuickKeyboard: Story = quick.keyboard;

/**
 * Removing is reversible, so it happens at once: no confirm dialog, a toast with
 * "Afturkalla" for 10 seconds (rule 5), focus on the next row. Afturkalla puts the liður
 * back where it was and focus on it.
 */
export const RemoveAndUndo: Story = {
  name: "Remove, then Afturkalla",
  args: { look: "inline", defaultEditingId: "l3" },
  render: inline.base.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Fjarlægja lið" }));
    await expect(canvas.queryByRole("alertdialog")).not.toBeInTheDocument();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Liður fjarlægður: Kortalestur í hverfinu."
    );
    await waitFor(() => expect(rowButton(canvasElement, "l4")).toHaveFocus());
    await userEvent.click(canvas.getByRole("button", { name: "Afturkalla" }));
    await waitFor(() => expect(rowButton(canvasElement, "l3")).toHaveFocus());
  },
};

/** One direction at a time, with controls. Changing a control remounts it with fresh data. */
export const Playground: Story = {
  name: "Playground",
  args: { look: "inline", defaultEditingId: "l4" },
  render: (args) => (
    <div style={wide}>
      <LidurEditorLab key={`${args.look}:${args.defaultEditingId ?? ""}`} {...args} />
    </div>
  ),
};
