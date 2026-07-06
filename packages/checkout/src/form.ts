import type { Field } from "./types.js";

export function renderForm(
  container: HTMLElement,
  fields: Field[],
  onSubmit: (values: Record<string, string>) => void
): { destroy: () => void } {
  const form = document.createElement("form");
  form.className = "twopay-form";

  // Map from field key to its input or select element
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();

  for (const field of fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "twopay-field";

    const fieldId = `twopay-${field.key}`;

    const label = document.createElement("label");
    label.textContent = field.label;
    label.htmlFor = fieldId;

    let control: HTMLInputElement | HTMLSelectElement;

    if (field.type === "select") {
      const select = document.createElement("select");
      select.name = field.key;
      select.id = fieldId;
      for (const opt of field.options) {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      control = select;
    } else {
      const input = document.createElement("input");
      input.type = field.type;
      input.name = field.key;
      input.id = fieldId;
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
      control = input;
    }

    wrapper.appendChild(label);
    wrapper.appendChild(control);
    form.appendChild(wrapper);

    inputs.set(field.key, control);
  }

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Continue";
  form.appendChild(submitButton);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    // Clear prior errors
    const priorErrors = form.querySelectorAll(".twopay-error");
    for (const el of priorErrors) {
      el.remove();
    }

    // Validate required fields
    let valid = true;
    for (const field of fields) {
      if (!field.required) continue;
      const control = inputs.get(field.key);
      if (!control || control.value.trim() === "") {
        valid = false;
        const error = document.createElement("span");
        error.className = "twopay-error";
        error.textContent = `${field.label} is required`;
        control?.parentElement?.appendChild(error);
      }
    }

    if (!valid) return;

    // Collect values
    const values: Record<string, string> = {};
    for (const field of fields) {
      const control = inputs.get(field.key);
      values[field.key] = control ? control.value : "";
    }

    onSubmit(values);
  });

  container.appendChild(form);

  return {
    destroy() {
      form.remove();
    },
  };
}
