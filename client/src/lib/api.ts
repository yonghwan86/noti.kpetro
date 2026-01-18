import { Asset, Team, User, Category, InspectionLog } from "./types";
import { auth as authHelper } from "./auth";

const API_BASE = "/api";

function getAuthHeaders(): HeadersInit {
  const userId = authHelper.getCurrentUserId();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return headers;
}

async function handleResponse<T>(res: Response, errorMessage: string): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: errorMessage }));
    throw new Error(error.error || errorMessage);
  }
  return res.json();
}

export const api = {
  teams: {
    getAll: async (): Promise<Team[]> => {
      const res = await fetch(`${API_BASE}/teams`, { cache: 'no-store' });
      return handleResponse(res, "Failed to fetch teams");
    },
    create: async (team: Omit<Team, "id">): Promise<Team> => {
      const res = await fetch(`${API_BASE}/teams`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(team),
      });
      return handleResponse(res, "Failed to create team");
    },
    update: async (id: string, updates: Partial<Team>): Promise<Team> => {
      const res = await fetch(`${API_BASE}/teams/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res, "Failed to update team");
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/teams/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete team" }));
        throw new Error(error.error || "Failed to delete team");
      }
    },
  },

  categories: {
    getAll: async (): Promise<Category[]> => {
      const res = await fetch(`${API_BASE}/categories`, { cache: 'no-store' });
      return handleResponse(res, "Failed to fetch categories");
    },
    create: async (category: Omit<Category, "id">): Promise<Category> => {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(category),
      });
      return handleResponse(res, "Failed to create category");
    },
    update: async (id: string, updates: Partial<Category>): Promise<Category> => {
      const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res, "Failed to update category");
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/categories/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete category" }));
        throw new Error(error.error || "Failed to delete category");
      }
    },
  },

  users: {
    getAll: async (): Promise<User[]> => {
      const res = await fetch(`${API_BASE}/users`, { cache: 'no-store' });
      return handleResponse(res, "Failed to fetch users");
    },
    create: async (user: Omit<User, "id">): Promise<User> => {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(user),
      });
      return handleResponse(res, "Failed to create user");
    },
    update: async (id: string, updates: Partial<User>): Promise<User> => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res, "Failed to update user");
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/users/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete user" }));
        throw new Error(error.error || "Failed to delete user");
      }
    },
  },

  assets: {
    getAll: async (): Promise<Asset[]> => {
      const res = await fetch(`${API_BASE}/assets`, { cache: 'no-store' });
      return handleResponse(res, "Failed to fetch assets");
    },
    create: async (asset: Omit<Asset, "id" | "status" | "nextDueDate"> & { inspectorId?: string }): Promise<Asset> => {
      const res = await fetch(`${API_BASE}/assets`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(asset),
      });
      return handleResponse(res, "Failed to create asset");
    },
    update: async (id: string, updates: Partial<Asset>): Promise<Asset> => {
      const res = await fetch(`${API_BASE}/assets/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res, "Failed to update asset");
    },
    inspect: async (id: string, data: { date: string; inspectorId: string; notes?: string }): Promise<Asset> => {
      const res = await fetch(`${API_BASE}/assets/${id}/inspect`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res, "Failed to update inspection");
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/assets/${id}`, { 
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete asset" }));
        throw new Error(error.error || "Failed to delete asset");
      }
    },
  },

  logs: {
    getAll: async (): Promise<InspectionLog[]> => {
      const res = await fetch(`${API_BASE}/logs`, { cache: 'no-store' });
      return handleResponse(res, "Failed to fetch logs");
    },
  },
};
