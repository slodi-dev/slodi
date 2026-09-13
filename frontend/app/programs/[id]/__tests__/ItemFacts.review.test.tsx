import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Program } from "@/services/programs.service";

import ItemFacts from "../components/ItemFacts";

/**
 * The server strips `review_state` from the payload unless the reader is the
 * item's author or a moderator, so the component's only job is to render what
 * it is given. These tests pin that: absent means absent, and a rejection
 * carries its note — that note is the whole reason the author is being told.
 */
function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: "1",
    title: "Eldur og eldamennska",
    description: "",
    workspace_id: "w1",
    ...overrides,
  } as Program;
}

describe("ItemFacts review state", () => {
  it("says nothing when the server sent no review state", () => {
    render(<ItemFacts program={makeProgram()} typeLabel="verkefnið" />);

    expect(screen.queryByText("Bíður yfirferðar")).not.toBeInTheDocument();
    expect(screen.queryByText("Samþykkt")).not.toBeInTheDocument();
    expect(screen.queryByText("Ekki samþykkt")).not.toBeInTheDocument();
  });

  it("shows the author that their item is still waiting", () => {
    render(
      <ItemFacts program={makeProgram({ review_state: "unreviewed" })} typeLabel="verkefnið" />
    );

    expect(screen.getByText("Bíður yfirferðar")).toBeInTheDocument();
  });

  it("shows a rejection together with the reason it was rejected", () => {
    render(
      <ItemFacts
        program={makeProgram({
          review_state: "rejected",
          review_note: "Vantar aldursbil.",
        })}
        typeLabel="verkefnið"
      />
    );

    expect(screen.getByText("Ekki samþykkt")).toBeInTheDocument();
    expect(screen.getByText("Vantar aldursbil.")).toBeInTheDocument();
  });
});
