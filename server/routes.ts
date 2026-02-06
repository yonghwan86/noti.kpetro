import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { auth, getCurrentUser, requireAuth } from "./auth";
import { 
  insertTeamSchema, 
  insertUserSchema, 
  insertAssetSchema,
  insertInspectionLogSchema 
} from "@shared/schema";
import { setupEmailAuth, registerEmailAuthRoutes } from "./emailAuth";
import * as excel from "./excel";
import { sendTestEmail, sendInspectionReminder } from "./emailService";
import { checkUpcomingInspections } from "./scheduler";

const upload = multer({ storage: multer.memoryStorage() });

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

  app.post("/api/teams", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const team = insertTeamSchema.parse(req.body);
      const created = await storage.createTeam(team);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid team data" });
    }
  });

  app.patch("/api/teams/:id", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const updateSchema = insertTeamSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateTeam(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.startsWith("REFERENCED:")) {
        const parts = error.message.split(":");
        const count = parts[1];
        const type = parts[2];
        if (type === 'users') {
          res.status(409).json({ error: `이 팀에 소속된 사용자가 ${count}명 있어 삭제할 수 없습니다. 먼저 사용자의 소속팀을 변경해주세요.` });
        } else {
          res.status(409).json({ error: `이 팀에 연결된 장비가 ${count}건 있어 삭제할 수 없습니다. 먼저 해당 장비의 팀을 변경해주세요.` });
        }
      } else {
        res.status(500).json({ error: "팀 삭제에 실패했습니다." });
      }
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const safeUsers = users.map(({ passwordHash, ...user }) => ({
        ...user,
        hasPassword: !!passwordHash,
      }));
      res.json(safeUsers);
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

  app.patch("/api/users/:id", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).currentUser;
      if (currentUser.role === 'manager') {
        const targetUser = await storage.getUser(req.params.id);
        if (targetUser && targetUser.role !== 'staff') {
          return res.status(403).json({ error: "장비관리자는 담당자(staff) 계정만 수정할 수 있습니다." });
        }
      }
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).currentUser;
      if (currentUser.role === 'manager') {
        const targetUser = await storage.getUser(req.params.id);
        if (targetUser && targetUser.role !== 'staff') {
          return res.status(403).json({ error: "장비관리자는 담당자(staff) 계정만 삭제할 수 있습니다." });
        }
      }
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.startsWith("REFERENCED:")) {
        const count = error.message.split(":")[1];
        res.status(409).json({ error: `이 사용자에게 연결된 장비가 ${count}건 있어 삭제할 수 없습니다. 먼저 해당 장비의 담당자 또는 장비관리자를 변경해주세요.` });
      } else {
        res.status(500).json({ error: "사용자 삭제에 실패했습니다." });
      }
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

  // Excel Export endpoints
  app.get("/api/teams/export", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const buffer = await excel.exportTeamsToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=teams.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to export teams" });
    }
  });

  app.get("/api/users/export", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const buffer = await excel.exportUsersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to export users" });
    }
  });

  app.get("/api/assets/export", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const buffer = await excel.exportAssetsToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=assets.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to export assets" });
    }
  });

  // Excel Template endpoints
  app.get("/api/teams/template", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const buffer = excel.getTeamTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=teams_template.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.get("/api/users/template", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const buffer = excel.getUserTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=users_template.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.get("/api/assets/template", requireAuth(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const buffer = excel.getAssetTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=assets_template.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  // Excel Import endpoints
  app.post("/api/teams/import", requireAuth(['admin']), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일을 업로드해주세요" });
      }
      const result = await excel.importTeamsFromExcel(req.file.buffer);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to import teams" });
    }
  });

  app.post("/api/users/import", requireAuth(['admin']), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일을 업로드해주세요" });
      }
      const result = await excel.importUsersFromExcel(req.file.buffer);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to import users" });
    }
  });

  app.post("/api/assets/import", requireAuth(['admin', 'manager']), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일을 업로드해주세요" });
      }
      const result = await excel.importAssetsFromExcel(req.file.buffer);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to import assets" });
    }
  });

  // Staff User Excel endpoints
  app.get("/api/staff/export", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const buffer = await excel.exportStaffUsersToExcel();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=staff_users.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to export staff users" });
    }
  });

  app.get("/api/staff/template", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const buffer = excel.getStaffUserTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=staff_template.xlsx");
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.post("/api/staff/import", requireAuth(['admin']), upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일을 업로드해주세요" });
      }
      const result = await excel.importStaffUsersFromExcel(req.file.buffer);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to import staff users" });
    }
  });

  // Email API endpoints
  app.post("/api/email/test", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ error: "수신자 이메일 주소가 필요합니다" });
      }
      const result = await sendTestEmail(to);
      if (result.success) {
        res.json({ message: "테스트 이메일이 발송되었습니다", messageId: result.messageId });
      } else {
        res.status(500).json({ error: result.error || "이메일 발송 실패" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "이메일 발송 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/email/team-test", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      const { teamId } = req.body;
      if (!teamId) {
        return res.status(400).json({ error: "팀 ID가 필요합니다" });
      }
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ error: "팀을 찾을 수 없습니다" });
      }
      if (!team.contactEmail) {
        return res.status(400).json({ error: "팀 연락처 이메일이 설정되어 있지 않습니다" });
      }
      const result = await sendTestEmail(team.contactEmail);
      if (result.success) {
        res.json({ 
          message: `${team.name}(${team.contactEmail})으로 테스트 이메일이 발송되었습니다`, 
          messageId: result.messageId 
        });
      } else {
        res.status(500).json({ error: result.error || "이메일 발송 실패" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "이메일 발송 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/email/check-inspections", requireAuth(['admin']), async (req: Request, res: Response) => {
    try {
      await checkUpcomingInspections();
      res.json({ message: "점검 알림 확인이 완료되었습니다. 서버 로그를 확인하세요." });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "점검 확인 중 오류가 발생했습니다" });
    }
  });

  return httpServer;
}
