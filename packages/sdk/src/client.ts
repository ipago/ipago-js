import type { operations } from "./schema.js";

type ProductList = operations["listProducts"]["responses"]["200"]["content"]["application/json"];
type Product = operations["getProduct"]["responses"]["200"]["content"]["application/json"];
type CategoryList = operations["listCategories"]["responses"]["200"]["content"]["application/json"];
type Category = operations["getCategory"]["responses"]["200"]["content"]["application/json"];
type WebhookEndpointList = operations["listWebhookEndpoints"]["responses"]["200"]["content"]["application/json"];
type WebhookEndpointCreated = operations["createWebhookEndpoint"]["responses"]["201"]["content"]["application/json"];
type WebhookEndpoint = operations["getWebhookEndpoint"]["responses"]["200"]["content"]["application/json"];
type WebhookEndpointDeleted = operations["deleteWebhookEndpoint"]["responses"]["200"]["content"]["application/json"];
type EventList = operations["listEvents"]["responses"]["200"]["content"]["application/json"];
type Event = operations["getEvent"]["responses"]["200"]["content"]["application/json"];
type TestEventResult = operations["sendTestEvent"]["responses"]["202"]["content"]["application/json"];

type CreateWebhookBody = operations["createWebhookEndpoint"]["requestBody"]["content"]["application/json"];
type ListCategoriesQuery = operations["listCategories"]["parameters"]["query"];
type GetCategoryQuery = operations["getCategory"]["parameters"]["query"];
type ListWebhookEndpointsQuery = operations["listWebhookEndpoints"]["parameters"]["query"];
type ListEventsQuery = operations["listEvents"]["parameters"]["query"];

export class TwoPayError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`2Pay API error ${status}`);
    this.name = "TwoPayError";
  }
}

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
      throw new TwoPayError(res.status, body);
    }
    return (await res.json()) as T;
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new TwoPayError(res.status, errBody);
    }
    return (await res.json()) as T;
  }

  private async del<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new TwoPayError(res.status, body);
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

  readonly categories = {
    list: (query?: ListCategoriesQuery): Promise<CategoryList> => {
      const params = new URLSearchParams();
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined) params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return this.get<CategoryList>(`/v1/categories${qs ? `?${qs}` : ""}`);
    },
    retrieve: (id: string, opts?: GetCategoryQuery): Promise<Category> => {
      const params = new URLSearchParams();
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          if (v !== undefined) params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return this.get<Category>(`/v1/categories/${id}${qs ? `?${qs}` : ""}`);
    },
  };

  readonly webhookEndpoints = {
    create: (body: CreateWebhookBody): Promise<WebhookEndpointCreated> =>
      this.post<WebhookEndpointCreated>("/v1/webhook_endpoints", body),
    list: (query?: ListWebhookEndpointsQuery): Promise<WebhookEndpointList> => {
      const params = new URLSearchParams();
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined) params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return this.get<WebhookEndpointList>(`/v1/webhook_endpoints${qs ? `?${qs}` : ""}`);
    },
    retrieve: (id: string): Promise<WebhookEndpoint> => this.get<WebhookEndpoint>(`/v1/webhook_endpoints/${id}`),
    del: (id: string): Promise<WebhookEndpointDeleted> => this.del<WebhookEndpointDeleted>(`/v1/webhook_endpoints/${id}`),
  };

  readonly events = {
    list: (query?: ListEventsQuery): Promise<EventList> => {
      const params = new URLSearchParams();
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (v !== undefined) params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return this.get<EventList>(`/v1/events${qs ? `?${qs}` : ""}`);
    },
    retrieve: (id: string): Promise<Event> => this.get<Event>(`/v1/events/${id}`),
    sendTest: (endpointId: string): Promise<TestEventResult> =>
      this.post<TestEventResult>(`/v1/webhook_endpoints/${endpointId}/test`),
  };
}
