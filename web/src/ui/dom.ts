import { ApiError } from "../api/client";

export function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function say(root: ParentNode, text: string, tone: "" | "bad" | "good" = "") {
  const el = root.querySelector<HTMLElement>("[data-room-msg]");
  if (!el) return;
  el.textContent = text;
  el.className = tone ? `msg ${tone}` : "msg";
}

export async function guard(root: ParentNode, work: () => Promise<void>) {
  try {
    await work();
  } catch (err) {
    const label = err instanceof ApiError ? err.message : "The vault could not do that.";
    say(root, label, "bad");
  }
}

let meterSeq = 0;

export function meter(label: string, value: number, tone = "") {
  const id = `meter-${++meterSeq}`;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return `<div class="bar-row ${esc(tone)}">
    <span class="bar-label" id="${id}">${esc(label)}</span>
    <div class="bar-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-labelledby="${id}"><i style="width:${v}%"></i></div>
    <span class="bar-val">${v}%</span>
  </div>`;
}

type EditorField = {
  name: string;
  label: string;
  value: string;
  type?: string;
  min?: string;
  max?: string;
  multiline?: boolean;
};

export function openRowEditor(
  host: HTMLElement,
  fields: EditorField[],
  onSave: (values: Record<string, string>) => Promise<void>,
  onCancel: () => void,
) {
  const form = document.createElement("form");
  form.className = "edit-form";
  for (const field of fields) {
    const label = document.createElement("label");
    label.className = "field";
    const span = document.createElement("span");
    span.textContent = field.label;
    const control = field.multiline ? document.createElement("textarea") : document.createElement("input");
    control.name = field.name;
    control.value = field.value;
    if (control instanceof HTMLInputElement) {
      control.type = field.type ?? "text";
      if (field.type === "number") control.inputMode = "numeric";
      if (field.min) control.min = field.min;
      if (field.max) control.max = field.max;
    }
    label.append(span, control);
    form.append(label);
  }
  const actions = document.createElement("div");
  actions.className = "form-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "primary";
  save.textContent = "Save";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ghost";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", onCancel);
  actions.append(save, cancel);
  form.append(actions);
  const status = document.createElement("p");
  status.className = "msg";
  status.setAttribute("role", "status");
  form.append(status);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data: Record<string, string> = {};
    for (const field of fields) {
      const el = form.elements.namedItem(field.name);
      data[field.name] = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value.trim() : "";
    }
    save.disabled = true;
    void onSave(data)
      .catch((err: unknown) => {
        save.disabled = false;
        status.textContent = err instanceof ApiError ? err.message : "Could not save that.";
        status.className = "msg bad";
      });
  });
  host.replaceChildren(form);
  form.querySelector("input, textarea")?.dispatchEvent(new Event("focus"));
  const first = form.querySelector<HTMLElement>("input, textarea");
  first?.focus();
}
