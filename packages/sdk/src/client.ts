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
type Checkout = operations["createCheckout"]["responses"]["201"]["content"]["application/json"];
type OrderList = operations["listOrders"]["responses"]["200"]["content"]["application/json"];
type Order = operations["getOrder"]["responses"]["200"]["content"]["application/json"];
type Balance = operations["getBalance"]["responses"]["200"]["content"]["application/json"];
type LedgerEntryList = operations["listLedgerEntries"]["responses"]["200"]["content"]["application/json"];
type PayoutList = operations["listPayouts"]["responses"]["200"]["content"]["application/json"];
type Payout = operations["createPayout"]["responses"]["201"]["content"]["application/json"];
type Refund = operations["createRefund"]["responses"]["201"]["content"]["application/json"];
type RefundList = operations["listRefunds"]["responses"]["200"]["content"]["application/json"];
type DeliveryList = operations["listDeliveries"]["responses"]["200"]["content"]["application/json"];
type Delivery = operations["getDelivery"]["responses"]["200"]["content"]["application/json"];
type DisputeList = operations["listDisputes"]["responses"]["200"]["content"]["application/json"];
type Dispute = operations["getDispute"]["responses"]["200"]["content"]["application/json"];
type RegisterBody = operations["register"]["requestBody"]["content"]["application/json"];
type RegisterResult = operations["register"]["responses"]["201"]["content"]["application/json"];
type LoginBody = operations["login"]["requestBody"]["content"]["application/json"];
type LoginResult = operations["login"]["responses"]["200"]["content"]["application/json"];
type LogoutResult = operations["logout"]["responses"]["200"]["content"]["application/json"];
type MeResult = operations["getMe"]["responses"]["200"]["content"]["application/json"];

type CreateWebhookBody = operations["createWebhookEndpoint"]["requestBody"]["content"]["application/json"];
type ListCategoriesQuery = operations["listCategories"]["parameters"]["query"];
type GetCategoryQuery = operations["getCategory"]["parameters"]["query"];
type ListWebhookEndpointsQuery = operations["listWebhookEndpoints"]["parameters"]["query"];
type ListEventsQuery = operations["listEvents"]["parameters"]["query"];
type CreateCheckoutBody = operations["createCheckout"]["requestBody"]["content"]["application/json"];
type ListOrdersQuery = operations["listOrders"]["parameters"]["query"];
type ListLedgerEntriesQuery = operations["listLedgerEntries"]["parameters"]["query"];
type ListPayoutsQuery = operations["listPayouts"]["parameters"]["query"];
type CreatePayoutBody = operations["createPayout"]["requestBody"]["content"]["application/json"];
type CreateRefundBody = operations["createRefund"]["requestBody"]["content"]["application/json"];
type ListRefundsQuery = operations["listRefunds"]["parameters"]["query"];
type ListDeliveriesQuery = operations["listDeliveries"]["parameters"]["query"];
type CompleteDeliveryBody = operations["completeDelivery"]["requestBody"]["content"]["application/json"];
type FailDeliveryBody = operations["failDelivery"]["requestBody"]["content"]["application/json"];
type ListDisputesQuery = operations["listDisputes"]["parameters"]["query"];

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

  private qs(query?: Record<string, string | number | boolean | undefined> | undefined): string {
    if (!query) return "";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `?${s}` : "";
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

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    options?: { body?: unknown; authToken?: string },
  ): Promise<T> {
    const bearer = options?.authToken != null ? `Bearer ${options.authToken}` : `Bearer ${this.apiKey}`;
    const headers: Record<string, string> = { authorization: bearer };
    if (options?.body !== undefined) headers["content-type"] = "application/json";
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new TwoPayError(res.status, errBody);
    }
    return (await res.json()) as T;
  }

  readonly products = {
    list: (query?: operations["listProducts"]["parameters"]["query"]): Promise<ProductList> =>
      this.get<ProductList>(`/v1/products${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Product> => this.get<Product>(`/v1/products/${id}`),
  };

  readonly categories = {
    list: (query?: ListCategoriesQuery): Promise<CategoryList> =>
      this.get<CategoryList>(`/v1/categories${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string, opts?: GetCategoryQuery): Promise<Category> =>
      this.get<Category>(`/v1/categories/${id}${this.qs(opts as Record<string, string | number | boolean | undefined>)}`),
  };

  readonly webhookEndpoints = {
    create: (body: CreateWebhookBody): Promise<WebhookEndpointCreated> =>
      this.post<WebhookEndpointCreated>("/v1/webhook_endpoints", body),
    list: (query?: ListWebhookEndpointsQuery): Promise<WebhookEndpointList> =>
      this.get<WebhookEndpointList>(`/v1/webhook_endpoints${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<WebhookEndpoint> => this.get<WebhookEndpoint>(`/v1/webhook_endpoints/${id}`),
    del: (id: string): Promise<WebhookEndpointDeleted> => this.del<WebhookEndpointDeleted>(`/v1/webhook_endpoints/${id}`),
  };

  readonly events = {
    list: (query?: ListEventsQuery): Promise<EventList> =>
      this.get<EventList>(`/v1/events${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Event> => this.get<Event>(`/v1/events/${id}`),
    sendTest: (endpointId: string): Promise<TestEventResult> =>
      this.post<TestEventResult>(`/v1/webhook_endpoints/${endpointId}/test`),
  };

  readonly checkouts = {
    create: (body: CreateCheckoutBody): Promise<Checkout> =>
      this.post<Checkout>("/v1/checkouts", body),
  };

  readonly orders = {
    list: (query?: ListOrdersQuery): Promise<OrderList> =>
      this.get<OrderList>(`/v1/orders${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Order> => this.get<Order>(`/v1/orders/${id}`),
  };

  readonly balance = {
    retrieve: (): Promise<Balance> => this.get<Balance>("/v1/balance"),
  };

  readonly ledgerEntries = {
    list: (query?: ListLedgerEntriesQuery): Promise<LedgerEntryList> =>
      this.get<LedgerEntryList>(`/v1/ledger_entries${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
  };

  readonly payouts = {
    create: (body: CreatePayoutBody): Promise<Payout> =>
      this.post<Payout>("/v1/payouts", body),
    list: (query?: ListPayoutsQuery): Promise<PayoutList> =>
      this.get<PayoutList>(`/v1/payouts${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Payout> =>
      this.get<Payout>(`/v1/payouts/${id}`),
  };

  readonly refunds = {
    create: (body: CreateRefundBody): Promise<Refund> =>
      this.post<Refund>("/v1/refunds", body),
    list: (query?: ListRefundsQuery): Promise<RefundList> =>
      this.get<RefundList>(`/v1/refunds${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Refund> =>
      this.get<Refund>(`/v1/refunds/${id}`),
  };

  readonly deliveries = {
    list: (query?: ListDeliveriesQuery): Promise<DeliveryList> =>
      this.get<DeliveryList>(`/v1/deliveries${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Delivery> =>
      this.get<Delivery>(`/v1/deliveries/${id}`),
    complete: (id: string, body?: CompleteDeliveryBody): Promise<Delivery> =>
      this.post<Delivery>(`/v1/deliveries/${id}/complete`, body),
    fail: (id: string, body?: FailDeliveryBody): Promise<Delivery> =>
      this.post<Delivery>(`/v1/deliveries/${id}/fail`, body),
  };

  readonly disputes = {
    list: (query?: ListDisputesQuery): Promise<DisputeList> =>
      this.get<DisputeList>(`/v1/disputes${this.qs(query as Record<string, string | number | boolean | undefined>)}`),
    retrieve: (id: string): Promise<Dispute> =>
      this.get<Dispute>(`/v1/disputes/${id}`),
  };

  readonly auth = {
    register: (body: RegisterBody): Promise<RegisterResult> =>
      this.request<RegisterResult>("POST", "/v1/auth/register", { body }),
    login: (body: LoginBody): Promise<LoginResult> =>
      this.request<LoginResult>("POST", "/v1/auth/login", { body }),
    logout: (token: string): Promise<LogoutResult> =>
      this.request<LogoutResult>("POST", "/v1/auth/logout", { authToken: token }),
    me: (token: string): Promise<MeResult> =>
      this.request<MeResult>("GET", "/v1/me", { authToken: token }),
  };
}
