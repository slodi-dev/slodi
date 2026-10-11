import { describe, expect, it } from "vitest";
import { isPrivateNetworkHost, isPrivateNetworkUrl, publicMediaUrl } from "./private-network";

describe("isPrivateNetworkUrl", () => {
  it.each([
    "http://localhost:8000/x.png",
    "http://LOCALHOST./x.png",
    "http://api.localhost/x.png",
    "http://printer.local/x.png",
    "http://127.0.0.1/x.png",
    "http://127.1/x.png", // URL normalises the short forms browsers accept
    "http://0x7f.0.0.1/x.png",
    "http://2130706433/x.png",
    "http://0.0.0.0/x.png",
    "http://10.1.2.3/x.png",
    "http://172.16.0.1/x.png",
    "http://172.31.255.255/x.png",
    "http://192.168.1.1/x.png",
    "http://169.254.169.254/latest",
    "http://100.64.0.1/x.png",
    "http://[::1]/x.png",
    "http://[::]/x.png",
    "http://[fc00::1]/x.png",
    "http://[fd12:3456::1]/x.png",
    "http://[fe80::1]/x.png",
    "http://[febf::1]/x.png",
    "http://[::ffff:127.0.0.1]/x.png",
    "http://[::ffff:192.168.0.1]/x.png",
  ])("flags %s", (url) => {
    expect(isPrivateNetworkUrl(url)).toBe(true);
  });

  it.each([
    "https://slodiblobstorage.blob.core.windows.net/content-images/images/a.png",
    "https://example.com/x.png",
    "https://localhost.example.com/x.png",
    "https://local.example/x.png",
    "http://172.15.0.1/x.png",
    "http://172.32.0.1/x.png",
    "http://192.169.0.1/x.png",
    "http://8.8.8.8/x.png",
    "http://[2001:db8::1]/x.png",
    "http://[fec0::1]/x.png",
    "http://[::ffff:8.8.8.8]/x.png",
    "/images/local.png",
    "data:image/png;base64,AAAA",
    "not a url at all",
  ])("allows %s", (url) => {
    expect(isPrivateNetworkUrl(url)).toBe(false);
  });
});

describe("isPrivateNetworkHost", () => {
  it("accepts bracketed and bare IPv6", () => {
    expect(isPrivateNetworkHost("[::1]")).toBe(true);
    expect(isPrivateNetworkHost("::1")).toBe(true);
  });

  it("rejects malformed addresses as not private rather than throwing", () => {
    expect(isPrivateNetworkHost("1:2:3")).toBe(false);
    expect(isPrivateNetworkHost("::1::2")).toBe(false);
    expect(isPrivateNetworkHost("")).toBe(false);
  });
});

describe("publicMediaUrl", () => {
  it("passes a public URL through unchanged", () => {
    const url = "https://slodiblobstorage.blob.core.windows.net/content-images/images/a.png";
    expect(publicMediaUrl(url)).toBe(url);
  });

  it("drops private hosts", () => {
    expect(publicMediaUrl("http://192.168.0.10/cam.jpg")).toBeUndefined();
    expect(publicMediaUrl("http://localhost:3000/x.png")).toBeUndefined();
  });

  it("drops empty values and schemes no image uses", () => {
    expect(publicMediaUrl(null)).toBeUndefined();
    expect(publicMediaUrl(undefined)).toBeUndefined();
    expect(publicMediaUrl("")).toBeUndefined();
    expect(publicMediaUrl("javascript:alert(1)")).toBeUndefined();
    expect(publicMediaUrl("file:///etc/passwd")).toBeUndefined();
  });

  it("keeps relative, data: and blob: URLs", () => {
    expect(publicMediaUrl("/x.png")).toBe("/x.png");
    expect(publicMediaUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(publicMediaUrl("blob:https://slodi.is/abc")).toBe("blob:https://slodi.is/abc");
  });
});
