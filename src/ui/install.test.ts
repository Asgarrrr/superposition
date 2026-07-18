import { describe, expect, it } from "vitest";
import { installMode, type InstallEnv } from "./install.ts";

const base: InstallEnv = {
  dismissed: false,
  standalone: false,
  hasPrompt: false,
  isIosSafari: false,
  mobile: true,
};

describe("installMode", () => {
  it("shows the Android banner when a prompt was captured", () => {
    expect(installMode({ ...base, hasPrompt: true })).toBe("android");
  });

  it("shows the iOS banner for iOS Safari without a prompt", () => {
    expect(installMode({ ...base, isIosSafari: true })).toBe("ios");
  });

  it("prefers the real Android prompt over the iOS hint", () => {
    expect(installMode({ ...base, hasPrompt: true, isIosSafari: true })).toBe(
      "android",
    );
  });

  it("shows nothing on a plain desktop browser", () => {
    expect(installMode({ ...base, mobile: false })).toBeNull();
  });

  it("shows nothing on desktop Chrome even though it fires the prompt", () => {
    expect(installMode({ ...base, hasPrompt: true, mobile: false })).toBeNull();
  });

  it("shows nothing once already standalone", () => {
    expect(
      installMode({ ...base, hasPrompt: true, standalone: true }),
    ).toBeNull();
    expect(
      installMode({ ...base, isIosSafari: true, standalone: true }),
    ).toBeNull();
  });

  it("shows nothing once dismissed", () => {
    expect(
      installMode({ ...base, hasPrompt: true, dismissed: true }),
    ).toBeNull();
    expect(
      installMode({ ...base, isIosSafari: true, dismissed: true }),
    ).toBeNull();
  });
});
