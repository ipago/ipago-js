export type Field =
  | {
      key: string;
      label: string;
      type: "text" | "email" | "number";
      required?: boolean;
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      type: "select";
      required?: boolean;
      options: { value: string; label: string }[];
    };

export interface MountOptions {
  element: string | HTMLElement;
  fields: Field[];
  createSession: (values: Record<string, string>) => Promise<{ clientSecret: string }>;
  publishableKey: string;
  onComplete?: (result: { sessionId?: string }) => void;
  onError?: (error: Error) => void;
}
