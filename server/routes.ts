import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { auth, getCurrentUser, requireAuth } from "./auth";
import { 
  insertTeamSchema, 
  insertCategorySchema, 
  insertUserSchema, 
  insertAssetSchema,
  insertInspectionLogSchema 
} from "@shared/schema";
import { setupEmailAuth, registerEmailAuthRoutes } from "./emailAuth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  setupEmailAuth(app);
  registerEmailAuthRoutes(app);
  
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const team = insertTeamSchema.parse(req.body);
      const created = await storage.createTeam(team);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid team data" });
    }
  });

  app.patch("/api/teams/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateTeam(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const category = insertCategorySchema.parse(req.body);
      const created = await storage.createCategory(category);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });

  app.patch("/api/categories/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const user = insertUserSchema.parse(req.body);
      const created = await storage.createUser(user);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/users/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/users/:id/reset-password", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const { resetUserPassword } = await import("./emailAuth");
      const updated = await resetUserPassword(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, message: "비밀번호가 초기화되었습니다." });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/assets", async (req, res) => {
    try {
      const assets = await storage.getAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });

  app.post("/api/assets", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).currentUser;
      const asset = insertAssetSchema.parse(req.body);
      const created = await storage.createAsset(asset);
      
      await storage.createLog({
        assetId: created.id,
        inspectorId: currentUser.id,
        notes: '장비 신규 등록'
      });
      
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid asset data" });
    }
  });

  app.patch("/api/assets/:id", async (req: Request, res: Response) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      if (!auth.canEditAsset(currentUser, asset)) {
        return res.status(403).json({ error: "You don't have permission to edit this asset" });
      }

      const updated = await storage.updateAsset(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update asset" });
    }
  });

  app.post("/api/assets/:id/inspect", async (req: Request, res: Response) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      if (!auth.canInspectAsset(currentUser, asset)) {
        return res.status(403).json({ error: "You don't have permission to inspect this asset" });
      }

      const { date, notes } = req.body;
      const updated = await storage.updateAssetInspection(req.params.id, date);
      if (!updated) {
        return res.status(404).json({ error: "Asset not found" });
      }

      await storage.createLog({
        assetId: updated.id,
        inspectorId: currentUser.id,
        notes: notes || `정기 점검 수행 (다음 예정일: ${updated.nextDueDate})`
      });

      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update inspection" });
    }
  });

  app.delete("/api/assets/:id", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      await storage.deleteAsset(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  app.get("/api/logs", async (req, res) => {
    try {
      const logs = await storage.getLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  return httpServer;
}
