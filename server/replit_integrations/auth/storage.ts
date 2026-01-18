import { users } from "@shared/schema";
import { db } from "../../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<any | undefined>;
  upsertUser(userData: any): Promise<any>;
  findUserByEmail(email: string): Promise<any | undefined>;
  linkReplitIdToUser(userId: string, replitId: string): Promise<any | undefined>;
}

class AuthStorage implements IAuthStorage {
  async getUser(replitId: string): Promise<any | undefined> {
    const [user] = await db.select().from(users).where(eq(users.replitId, replitId));
    return user;
  }

  async findUserByEmail(email: string): Promise<any | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async linkReplitIdToUser(userId: string, replitId: string): Promise<any | undefined> {
    const [user] = await db
      .update(users)
      .set({ replitId })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async upsertUser(userData: any): Promise<any> {
    const existingUser = await this.getUser(userData.id);
    if (existingUser) {
      return existingUser;
    }

    if (userData.email) {
      const userByEmail = await this.findUserByEmail(userData.email);
      if (userByEmail) {
        return await this.linkReplitIdToUser(userByEmail.id, userData.id);
      }
    }

    return null;
  }
}

export const authStorage = new AuthStorage();
