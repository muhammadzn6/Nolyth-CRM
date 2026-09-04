import type {
  BulkImportRequest,
  BulkImportResult,
  CreateCompany,
  UpdateCompanyRequest,
  CompanySummary,
  LoginRequest,
  SessionUser,
} from "@orbit/contracts";
export { ORBIT_DOCUMENTED_ROUTES } from "./routes.generated";

export const ORBIT_API_OPERATIONS = {
  login: { method: "POST", path: "/auth/login" },
  logout: { method: "POST", path: "/auth/logout" },
  me: { method: "GET", path: "/auth/me" },
  changePassword: { method: "POST", path: "/auth/change-password" },
  requestPasswordReset: { method: "POST", path: "/auth/password-reset/request" },
  completePasswordReset: { method: "POST", path: "/auth/password-reset/complete" },
  listUsers: { method: "GET", path: "/users" },
  inviteUser: { method: "POST", path: "/users" },
  updateUser: { method: "PATCH", path: "/users/{id}" },
  listCompanies: { method: "GET", path: "/leads/companies" },
  createCompany: { method: "POST", path: "/leads/companies" },
  updateCompany: { method: "PATCH", path: "/leads/companies/{companyId}" },
  importCandidates: { method: "POST", path: "/imports/candidates" },
  importLeads: { method: "POST", path: "/imports/leads" },
  listLeads: { method: "GET", path: "/leads" },
  getLead: { method: "GET", path: "/leads/{leadId}" },
  listCandidates: { method: "GET", path: "/candidates" },
  listProfiles: { method: "GET", path: "/profiles" },
  listCalendar: { method: "GET", path: "/calendar" },
  checkGoogleCalendarBusy: { method: "GET", path: "/calendar/google/free-busy" },
  connectCandidateCalendar: { method: "GET", path: "/calendar/google/connect" },
  candidateCalendarStatus: { method: "GET", path: "/calendar/google/status" },
  disconnectCandidateCalendar: { method: "DELETE", path: "/calendar/google" },
  listTasks: { method: "GET", path: "/tasks" },
  dashboard: { method: "GET", path: "/dashboard" },
  activity: { method: "GET", path: "/activity" },
  notifications: { method: "GET", path: "/notifications" },
} as const;

export type OrbitApiClientOptions = {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  credentials?: RequestCredentials;
};

export class OrbitApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "OrbitApiError";
  }
}

type ApiBody<T> = {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string };
  meta?: { requestId?: string };
};

export class OrbitApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly credentials: RequestCredentials;

  constructor(options: OrbitApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.credentials = options.credentials ?? "include";
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      credentials: this.credentials,
      headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => null) as ApiBody<T> | null;
    if (!response.ok || body?.success === false) {
      throw new OrbitApiError(
        body?.error?.message ?? "Orbit could not complete the request.",
        body?.error?.code ?? "HTTP_ERROR",
        response.status,
        body?.meta?.requestId,
      );
    }
    return (body?.success === true ? body.data : body) as T;
  }

  login(input: LoginRequest): Promise<{ user: SessionUser }> {
    return this.request("/auth/login", { method: "POST", body: JSON.stringify(input) });
  }

  logout(): Promise<void> {
    return this.request<void>("/auth/logout", { method: "POST" });
  }

  me(): Promise<SessionUser> {
    return this.request("/auth/me");
  }

  listCompanies(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/leads/companies${this.query(query)}`);
  }

  createCompany(input: CreateCompany): Promise<CompanySummary> {
    return this.request("/leads/companies", { method: "POST", body: JSON.stringify(input) });
  }

  updateCompany(companyId: string, input: UpdateCompanyRequest): Promise<CompanySummary> {
    return this.request(`/leads/companies/${encodeURIComponent(companyId)}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  importCandidates(input: BulkImportRequest): Promise<BulkImportResult> {
    return this.request("/imports/candidates", { method: "POST", body: JSON.stringify(input) });
  }

  importLeads(input: BulkImportRequest): Promise<BulkImportResult> {
    return this.request("/imports/leads", { method: "POST", body: JSON.stringify(input) });
  }

  listLeads(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/leads${this.query(query)}`);
  }

  listCandidates(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/candidates${this.query(query)}`);
  }

  listProfiles(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/profiles${this.query(query)}`);
  }

  listCalendar(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/calendar${this.query(query)}`);
  }

  checkGoogleCalendarBusy(query: { profileId?: string; companyId?: string; startsAt: string; endsAt: string }): Promise<{ busy: boolean }> {
    return this.request(`/calendar/google/free-busy${this.query(query)}`);
  }

  connectCandidateCalendar(profileId: string): Promise<{ authorizationUrl: string }> {
    return this.request(`/calendar/google/connect${this.query({ profileId })}`);
  }

  candidateCalendarStatus(profileId: string): Promise<unknown> {
    return this.request(`/calendar/google/status${this.query({ profileId })}`);
  }

  disconnectCandidateCalendar(profileId: string): Promise<void> {
    return this.request(`/calendar/google${this.query({ profileId })}`, { method: "DELETE" });
  }

  listTasks(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/tasks${this.query(query)}`);
  }

  dashboard(): Promise<unknown> {
    return this.request("/dashboard");
  }

  activity(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/activity${this.query(query)}`);
  }

  notifications(query?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request(`/notifications${this.query(query)}`);
  }

  private query(values?: Record<string, string | number | boolean | undefined>): string {
    if (!values) return "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value !== undefined) params.set(key, String(value));
    const result = params.toString();
    return result ? `?${result}` : "";
  }
}
