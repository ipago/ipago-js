import { describe, it, expect } from "vitest";
import { mount } from "./checkout.js";

describe("mount", () => {
  it("is a function", () => {
    expect(typeof mount).toBe("function");
  });
});
