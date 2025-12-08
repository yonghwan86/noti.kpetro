import { Asset, Team, User, Category, InspectionLog } from "./types";

const API_BASE = "/api";

export const api = {
  teams: {
    getAll: async (): Promise<Team[]> => {
      const res = await fetch(`${API_BASE}/teams`);
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
    create: async (team: Omit<Team, "id">): Promise<Team> => {
      const res = await fetch(`${API_BASE}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(team),
      });
      if (!res.ok) throw new Error("Failed to create team");
      return res.json();
    },
    update: async (id: string, updates: Partial<Team>): Promise<Team> => {
      const res = await fetch(`${API_BASE}/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update team");
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/teams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete team");
    },
  },

  categories: {
    getAll: async (): Promise<Category[]> => {
      const res = await fetch(`${API_BASE}/categories`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    create: async (category: Omit<Category, "id">): Promise<Category> => {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category),
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    update: async (id: string, updates: Partial<Category>): Promise<Category> => {
      const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update category");
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete category");
    },
  },

  users: {
    getAll: async (): Promise<User[]> => {
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    create: async (user: Omit<User, "id">): Promise<User> => {
      const res = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    update: async (id: string, updates: Partial<User>): Promise<User> => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
    },
  },

  assets: {
    getAll: async (): Promise<Asset[]> => {
      const res = await fetch(`${API_BASE}/assets`);
      if (!res.ok) throw new Error("Failed to fetch assets");
      return res.json();
    },
    create: async (asset: Omit<Asset, "id" | "status" | "nextDueDate"> & { inspectorId?: string }): Promise<Asset> => {
      const res = await fetch(`${API_BASE}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset),
      });
      if (!res.ok) throw new Error("Failed to create asset");
      return res.json();
    },
    update: async (id: string, updates: Partial<Asset>): Promise<Asset> => {
      const res = await fetch(`${API_BASE}/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update asset");
      return res.json();
    },
    inspect: async (id: string, data: { date: string; inspectorId: string; notes?: string }): Promise<Asset> => {
      const res = await fetch(`${API_BASE}/assets/${id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update inspection");
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE}/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
    },
  },

  logs: {
    getAll: async (): Promise<InspectionLog[]> => {
      const res = await fetch(`${API_BASE}/logs`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  },
};
