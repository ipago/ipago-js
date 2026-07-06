import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderForm } from "./form.js";
import type { Field } from "./types.js";

const fields: Field[] = [
  { key: "player_name", label: "Username", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  {
    key: "region",
    label: "Region",
    type: "select",
    required: false,
    options: [
      { value: "eu", label: "EU" },
      { value: "us", label: "US" },
    ],
  },
];

describe("renderForm", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders one labeled input per field plus a submit button", () => {
    const onSubmit = vi.fn();
    renderForm(container, fields, onSubmit);

    // text input for player_name
    const nameInput = container.querySelector<HTMLInputElement>(
      'input[type="text"]'
    );
    expect(nameInput).not.toBeNull();

    // email input for email
    const emailInput = container.querySelector<HTMLInputElement>(
      'input[type="email"]'
    );
    expect(emailInput).not.toBeNull();

    // select for region with correct options
    const select = container.querySelector<HTMLSelectElement>("select");
    expect(select).not.toBeNull();
    expect(select!.options.length).toBe(2);
    expect(select!.options[0].value).toBe("eu");
    expect(select!.options[1].value).toBe("us");

    // labels
    const labels = container.querySelectorAll("label");
    expect(labels.length).toBe(3);
    const labelTexts = Array.from(labels).map((l) => l.textContent);
    expect(labelTexts).toContain("Username");
    expect(labelTexts).toContain("Email");
    expect(labelTexts).toContain("Region");

    // submit button
    const button = container.querySelector("button[type='submit']");
    expect(button).not.toBeNull();
  });

  it("does NOT call onSubmit and shows errors when required fields are empty", () => {
    const onSubmit = vi.fn();
    renderForm(container, fields, onSubmit);

    const form = container.querySelector("form")!;

    // leave player_name and email empty, submit
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(onSubmit).not.toHaveBeenCalled();

    // error nodes should appear for the two required-but-empty fields
    const errors = container.querySelectorAll(".twopay-error");
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSubmit exactly once with collected values when all required fields are filled", () => {
    const onSubmit = vi.fn();
    renderForm(container, fields, onSubmit);

    const form = container.querySelector("form")!;
    const nameInput =
      container.querySelector<HTMLInputElement>('input[type="text"]')!;
    const emailInput =
      container.querySelector<HTMLInputElement>('input[type="email"]')!;

    nameInput.value = "TestUser";
    emailInput.value = "test@example.com";
    // region defaults to first option "eu"

    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      player_name: "TestUser",
      email: "test@example.com",
      region: "eu",
    });
  });

  it("clears prior errors on a subsequent submit attempt", () => {
    const onSubmit = vi.fn();
    renderForm(container, fields, onSubmit);

    const form = container.querySelector("form")!;

    // first submit with empty fields to generate errors
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    expect(container.querySelectorAll(".twopay-error").length).toBeGreaterThan(0);

    // fill required fields and submit again
    const nameInput =
      container.querySelector<HTMLInputElement>('input[type="text"]')!;
    const emailInput =
      container.querySelector<HTMLInputElement>('input[type="email"]')!;
    nameInput.value = "Alice";
    emailInput.value = "alice@example.com";

    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".twopay-error").length).toBe(0);
  });

  it("destroy() removes rendered nodes from the container", () => {
    const onSubmit = vi.fn();
    const { destroy } = renderForm(container, fields, onSubmit);

    expect(container.querySelector("form")).not.toBeNull();
    destroy();
    expect(container.querySelector("form")).toBeNull();
    expect(container.children.length).toBe(0);
  });
});
