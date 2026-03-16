import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgramCard, { type ProgramCardProps } from "../ProgramCard";

// ── Mock context dependencies ────────────────────────────────────────────────

let mockIsLiked = false;
let mockLikeCount = 0;
const mockToggleLike = vi.fn();
const mockToggleFavorite = vi.fn();
let mockIsFavorite = false;

vi.mock("@/contexts/LikesContext", () => ({
  useLikes: (_id: string, initialCount: number, initialLiked: boolean) => ({
    likeCount: mockLikeCount || initialCount,
    isLiked: mockIsLiked ?? initialLiked,
    toggleLike: mockToggleLike,
  }),
}));

vi.mock("@/contexts/FavoritesContext", () => ({
  useFavorite: () => ({
    isFavorite: mockIsFavorite,
    toggleFavorite: mockToggleFavorite,
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ fill, ...rest }: Record<string, unknown>) => {
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function createProps(overrides: Partial<ProgramCardProps> = {}): ProgramCardProps {
  return {
    id: "prog-1",
    name: "Test Program",
    description: "A test description",
    image: "/test-image.jpg",
    author: { id: "author-1", name: "Test Author" },
    tags: [
      { id: "t1", name: "Tag1" },
      { id: "t2", name: "Tag2" },
    ],
    like_count: 5,
    liked_by_me: false,
    created_at: "2026-01-15T12:00:00Z",
    duration_min: 30,
    duration_max: 60,
    count_min: 5,
    count_max: 15,
    price: 1500,
    location: "Reykjavík",
    age: ["Hrefnuskátar", "Drekaskátar"],
    canEdit: false,
    canDelete: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ProgramCard", () => {
  beforeEach(() => {
    mockIsLiked = false;
    mockLikeCount = 0;
    mockIsFavorite = false;
    mockToggleLike.mockClear();
    mockToggleFavorite.mockClear();
  });

  it("renders with all required props (name and author visible)", () => {
    render(<ProgramCard {...createProps()} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Test Program");
    expect(screen.getByText("Test Author")).toBeInTheDocument();
  });

  it("article element has correct aria-label", () => {
    render(<ProgramCard {...createProps({ name: "Scout Adventure" })} />);

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("aria-label", "Scout Adventure");
  });

  it("renders metadata <dl> with <dt> and <dd> pairs", () => {
    const { container } = render(<ProgramCard {...createProps()} />);

    const dl = container.querySelector("dl");
    expect(dl).toBeInTheDocument();

    // Check that sr-only <dt> elements are present
    const dtElements = container.querySelectorAll("dt");
    const dtTexts = Array.from(dtElements).map((dt) => dt.textContent);
    expect(dtTexts).toContain("Lengd");
    expect(dtTexts).toContain("Fjöldi þátttakenda");
    expect(dtTexts).toContain("Kostnaður");
    expect(dtTexts).toContain("Staðsetning");

    // Check dd elements exist
    const ddElements = container.querySelectorAll("dd");
    expect(ddElements.length).toBeGreaterThanOrEqual(4);
  });

  it("like button has aria-pressed=false when not liked", () => {
    mockIsLiked = false;
    render(<ProgramCard {...createProps()} />);

    const likeButton = screen.getByRole("button", {
      name: /gefa rokkstig/i,
    });
    expect(likeButton).toHaveAttribute("aria-pressed", "false");
  });

  it("like button has aria-pressed=true when liked", () => {
    mockIsLiked = true;
    render(<ProgramCard {...createProps({ liked_by_me: true })} />);

    const likeButton = screen.getByRole("button", {
      name: /taka rokkstig til baka/i,
    });
    expect(likeButton).toHaveAttribute("aria-pressed", "true");
  });

  it("shows +N overflow indicator when tags exceed 4", () => {
    const tags = [
      { id: "t1", name: "Tag1" },
      { id: "t2", name: "Tag2" },
      { id: "t3", name: "Tag3" },
      { id: "t4", name: "Tag4" },
      { id: "t5", name: "Tag5" },
      { id: "t6", name: "Tag6" },
    ];
    render(<ProgramCard {...createProps({ tags })} />);

    // Should show 4 visible tags + overflow indicator
    expect(screen.getByText("Tag1")).toBeInTheDocument();
    expect(screen.getByText("Tag4")).toBeInTheDocument();
    expect(screen.queryByText("Tag5")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();

    // Overflow indicator should have aria-label
    const overflow = screen.getByText("+2");
    expect(overflow.closest("[aria-label]")).toHaveAttribute("aria-label", "2 fleiri flokkar");
  });

  it("hides edit/delete buttons when canEdit and canDelete are false", () => {
    render(<ProgramCard {...createProps({ canEdit: false, canDelete: false })} />);

    expect(screen.queryByRole("button", { name: /breyta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eyða/i })).not.toBeInTheDocument();
    // The three-dot menu should also be absent
    expect(screen.queryByRole("button", { name: "Valkostir" })).not.toBeInTheDocument();
  });

  it("shows edit and delete buttons when canEdit and canDelete are true", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ProgramCard
        {...createProps({
          canEdit: true,
          canDelete: true,
          onEdit,
          onDelete,
        })}
      />
    );

    // Footer edit/delete buttons
    expect(screen.getByRole("button", { name: /breyta test program/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eyða test program/i })).toBeInTheDocument();
  });

  it("image has non-empty alt attribute", () => {
    render(<ProgramCard {...createProps()} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt");
    expect(img.getAttribute("alt")).not.toBe("");
  });

  it("shows 'Kostnaðarlaust' when price is 0", () => {
    render(<ProgramCard {...createProps({ price: 0 })} />);

    expect(screen.getByText("Kostnaðarlaust")).toBeInTheDocument();
  });

  it("does not render metadata <dl> when all metadata fields are empty", () => {
    const { container } = render(
      <ProgramCard
        {...createProps({
          duration_min: null,
          duration_max: null,
          count_min: null,
          count_max: null,
          price: null,
          location: null,
        })}
      />
    );

    expect(container.querySelector("dl")).not.toBeInTheDocument();
  });

  it("renders age group badges", () => {
    render(<ProgramCard {...createProps({ age: ["Hrefnuskátar", "Drekaskátar"] })} />);

    expect(screen.getByText("Hrefnuskátar")).toBeInTheDocument();
    expect(screen.getByText("Drekaskátar")).toBeInTheDocument();
  });

  it("renders placeholder when no image is provided", () => {
    render(<ProgramCard {...createProps({ image: null })} />);

    // Should not render an <img> but should still have the card
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const article = screen.getByRole("article");
    expect(article).toBeInTheDocument();
  });
});
