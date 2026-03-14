import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgeGroupFilter from "../AgeGroupFilter";
import PriceFilter from "../PriceFilter";
import SearchInput from "../SearchInput";

// ── Mock CollapsibleSection to render children directly ──────────────────────

vi.mock("@/components/ui/CollapsibleSection", () => ({
  default: ({
    children,
    label,
  }: {
    children: React.ReactNode;
    label: string;
    activeCount?: number;
    defaultOpen?: boolean;
  }) => (
    <div data-testid="collapsible" data-label={label}>
      {children}
    </div>
  ),
}));

// ── AgeGroupFilter ───────────────────────────────────────────────────────────

describe("AgeGroupFilter", () => {
  const AGE_GROUPS = [
    "Hrefnuskátar",
    "Drekaskátar",
    "Fálkaskátar",
    "Dróttskátar",
    "Rekkaskátar",
    "Róverskátar",
    "Vættaskátar",
  ];

  it("renders all seven age groups", () => {
    const onChange = vi.fn();
    render(<AgeGroupFilter selected={[]} onChange={onChange} />);

    for (const group of AGE_GROUPS) {
      expect(screen.getByText(group)).toBeInTheDocument();
    }

    // All checkboxes rendered
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(7);
  });

  it("selecting an item calls onChange with correct array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AgeGroupFilter selected={[]} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: /hrefnuskátar/i });
    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(["Hrefnuskátar"]);
  });

  it("deselecting removes item from array", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AgeGroupFilter selected={["Hrefnuskátar", "Drekaskátar"]} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: /hrefnuskátar/i });
    await user.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(["Drekaskátar"]);
  });

  it("has role=group with aria-label", () => {
    render(<AgeGroupFilter selected={[]} onChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: "Aldurshópar" });
    expect(group).toBeInTheDocument();
  });

  it("checkboxes reflect selected state via checked", () => {
    render(<AgeGroupFilter selected={["Fálkaskátar"]} onChange={vi.fn()} />);

    const selectedCheckbox = screen.getByRole("checkbox", {
      name: /fálkaskátar/i,
    });
    expect(selectedCheckbox).toBeChecked();

    const unselectedCheckbox = screen.getByRole("checkbox", {
      name: /hrefnuskátar/i,
    });
    expect(unselectedCheckbox).not.toBeChecked();
  });
});

// ── PriceFilter ──────────────────────────────────────────────────────────────

describe("PriceFilter", () => {
  it("renders freeOnly checkbox", () => {
    render(<PriceFilter freeOnly={false} maxPrice={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("Einungis kostnaðarlaust")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("hides price input when freeOnly is checked", () => {
    render(<PriceFilter freeOnly={true} maxPrice={undefined} onChange={vi.fn()} />);

    expect(screen.queryByRole("spinbutton", { name: /hámarksverð/i })).not.toBeInTheDocument();
  });

  it("shows price input when freeOnly is unchecked", () => {
    render(<PriceFilter freeOnly={false} maxPrice={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: /hámarksverð/i })).toBeInTheDocument();
  });

  it("calls onChange when freeOnly checkbox is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PriceFilter freeOnly={false} maxPrice={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true, undefined);
  });

  it("freeOnly checkbox reflects checked state", () => {
    const { rerender } = render(
      <PriceFilter freeOnly={false} maxPrice={undefined} onChange={vi.fn()} />
    );

    expect(screen.getByRole("checkbox")).not.toBeChecked();

    rerender(<PriceFilter freeOnly={true} maxPrice={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});

// ── SearchInput ──────────────────────────────────────────────────────────────

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("typing calls onChange after debounce", async () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);

    const input = screen.getByRole("searchbox");
    // Simulate typing by changing the value via fireEvent
    await act(async () => {
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, "test");
    });

    // Advance timers to trigger debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // onChange should have been called with the typed value
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toContain("test");
  });

  it("clear button appears when value is non-empty", () => {
    render(<SearchInput value="hello" onChange={vi.fn()} />);

    const clearButton = screen.getByRole("button", { name: /hreinsa leit/i });
    expect(clearButton).toBeInTheDocument();
  });

  it("clear button is hidden when value is empty", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /hreinsa leit/i })).not.toBeInTheDocument();
  });

  it("clear button click resets the input", async () => {
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} />);

    const clearButton = screen.getByRole("button", { name: /hreinsa leit/i });

    await act(async () => {
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(clearButton);
    });

    // Should have called onChange with empty string immediately
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("has correct aria-label on the search input", () => {
    render(<SearchInput value="" onChange={vi.fn()} />);

    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("aria-label", "Leita að dagskrá");
  });
});
