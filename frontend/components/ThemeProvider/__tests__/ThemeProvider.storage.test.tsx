import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import ThemeProvider from "../index";

// ThemeProvider sits in the root layout, so it mounts on every page. It used to
// read localStorage unguarded, and in Safari with "Block All Cookies" that
// access throws a SecurityError — which React surfaces as "Application error: a
// client-side exception has occurred", taking down the whole site rather than
// just the theme. This is the regression test for that.

const realLocal = Object.getOwnPropertyDescriptor(window, "localStorage");

// jsdom has no matchMedia, and ThemeProvider consults it for the system colour
// preference. Not part of what is under test — just enough for it to mount.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

function blockStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

afterEach(() => {
  cleanup();
  if (realLocal) Object.defineProperty(window, "localStorage", realLocal);
});

describe("ThemeProvider in a browser that blocks storage", () => {
  it("still renders the page instead of throwing", () => {
    blockStorage();
    expect(() =>
      render(
        <ThemeProvider>
          <p>Dagskrárvefurinn</p>
        </ThemeProvider>
      )
    ).not.toThrow();
    expect(screen.getByText("Dagskrárvefurinn")).toBeInTheDocument();
  });

  it("renders normally when storage works", () => {
    render(
      <ThemeProvider>
        <p>Dagskrárvefurinn</p>
      </ThemeProvider>
    );
    expect(screen.getByText("Dagskrárvefurinn")).toBeInTheDocument();
  });
});
