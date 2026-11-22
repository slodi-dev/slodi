import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LikeButton from "../LikeButton";

const likes = { isLiked: false, likeCount: 3, toggleLike: vi.fn() };

vi.mock("@/contexts/LikesContext", () => ({
  useLikes: () => likes,
}));

describe("LikeButton", () => {
  it("names the action in Icelandic, with the count", () => {
    render(<LikeButton programId="p1" initialLikeCount={3} />);
    expect(screen.getByRole("button", { name: "Gefa rokkstig, 3 rokkstig" })).toBeInTheDocument();
  });

  it("offers to take the rokkstig back once given", () => {
    likes.isLiked = true;
    render(<LikeButton programId="p1" initialLikeCount={3} />);
    expect(
      screen.getByRole("button", { name: "Taka rokkstig til baka, 3 rokkstig" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("groups a large count the Icelandic way, in the name and on screen", () => {
    likes.isLiked = false;
    likes.likeCount = 1048;
    render(<LikeButton programId="p1" initialLikeCount={1048} />);
    const button = screen.getByRole("button", { name: "Gefa rokkstig, 1.048 rokkstig" });
    expect(button).toHaveTextContent("1.048");
  });
});
