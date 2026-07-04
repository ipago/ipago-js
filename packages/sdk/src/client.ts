import type { paths } from "./schema.js";

type ProductList = paths["/v1/products"]["get"]["responses"]["200"]["content"]["application/json"];
type Product = paths["/v1/products/{id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type TwoPayOptions = { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch };

export class TwoPay {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TwoPayOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`2Pay API ${res.status}: ${JSON.stringify(body)}`);
    }
    return (await res.json()) as T;
  }

  readonly products = {
    list: (query?: { limit?: number; starting_after?: string; active?: "true" | "false"; category?: string }): Promise<ProductList> => {
      const params = new URLSearchParams();
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined) params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return this.get<ProductList>(`/v1/products${qs ? `?${qs}` : ""}`);
    },
    retrieve: (id: string): Promise<Product> => this.get<Product>(`/v1/products/${id}`),
  };
}
