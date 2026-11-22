import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";

import config from "../../../../next.config";
import ItemHero from "../components/ItemHero";

const BLOB = "https://slodiblobstorage.blob.core.windows.net/content-images/images/a.jpg";
const FOREIGN = "https://example.com/mynd.jpg";

// The real next/image with the app's own `images` config, which `next build`
// would otherwise inline: an unconfigured host throws, as it does in dev.
const imageConfig = { ...imageConfigDefault, ...config(PHASE_DEVELOPMENT_SERVER).images };

function heroImg(images: { url: string; alt: string }[], index = 0) {
  const { container } = render(
    <ImageConfigContext.Provider value={imageConfig}>
      <ItemHero images={images} index={index} onIndexChange={() => {}} />
    </ImageConfigContext.Provider>
  );
  const img = container.querySelector("img");
  if (!img) throw new Error("no <img> rendered");
  return img;
}

describe("ItemHero image", () => {
  it("sends an uploaded picture through the optimiser, as the LCP image", () => {
    const img = heroImg([{ url: BLOB, alt: "Varðeldur" }]);
    expect(img.getAttribute("src")).toMatch(/^\/_next\/image\?url=/);
    expect(img.getAttribute("srcset")).toContain("/_next/image?url=");
    expect(img.getAttribute("sizes")).toBe("(max-width: 1079px) 100vw, 760px");
    expect(img.getAttribute("fetchpriority")).toBe("high");
    expect(img.getAttribute("loading")).not.toBe("lazy");
  });

  it("loads a picture from another host directly", () => {
    const img = heroImg([{ url: FOREIGN, alt: "" }]);
    expect(img.getAttribute("src")).toBe(FOREIGN);
    expect(img.getAttribute("srcset")).toBeNull();
  });

  it("only prioritises the first picture of a set", () => {
    const img = heroImg(
      [
        { url: BLOB, alt: "" },
        { url: BLOB.replace("a.jpg", "b.jpg"), alt: "" },
      ],
      1
    );
    expect(img.getAttribute("fetchpriority")).toBeNull();
    expect(img.getAttribute("loading")).toBe("lazy");
  });
});
