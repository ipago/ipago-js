import type { MountOptions } from "./types.js";

export function mount(_options: MountOptions): { unmount: () => void } {
  throw new Error("not implemented");
}
