import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user (returns the app user linked to Replit auth)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const replitId = req.user.claims.sub;
      const email = req.user.claims.email;
      
      // First check if user is already linked by replitId
      let user = await authStorage.getUser(replitId);
      
      // If not found by replitId, try to match by email
      if (!user && email) {
        const userByEmail = await authStorage.findUserByEmail(email);
        if (userByEmail) {
          // Link this Replit account to the app user
          user = await authStorage.linkReplitIdToUser(userByEmail.id, replitId);
        }
      }
      
      if (!user) {
        // User exists in Replit but not registered in our app
        return res.json({ 
          authenticated: true,
          registered: false,
          replitId,
          email,
          message: "이 이메일로 등록된 사용자가 없습니다. 관리자에게 문의하세요."
        });
      }
      
      res.json({ 
        authenticated: true, 
        registered: true, 
        user 
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Check if user is authenticated (without requiring linking)
  app.get("/api/auth/status", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.json({ authenticated: false });
    }
    res.json({ 
      authenticated: true, 
      replitId: req.user?.claims?.sub,
      email: req.user?.claims?.email
    });
  });
}
