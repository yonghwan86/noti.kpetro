import * as XLSX from "xlsx";
import { storage } from "./storage";
import type { Team, Category, User, Asset } from "@shared/schema";

export async function exportTeamsToExcel(): Promise<Buffer> {
  const teams = await storage.getTeams();
  
  const data = teams.map(t => ({
    "팀명": t.name,
    "담당자 이메일": t.contactEmail,
    "연락처": t.phone || "",
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "팀");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportCategoriesToExcel(): Promise<Buffer> {
  const categories = await storage.getCategories();
  const users = await storage.getUsers();
  
  const data = categories.map(c => ({
    "카테고리명": c.name,
    "관리자": users.find(u => u.id === c.managerId)?.username || "",
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "카테고리");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportUsersToExcel(): Promise<Buffer> {
  const users = await storage.getUsers();
  const teams = await storage.getTeams();
  
  const roleMap: Record<string, string> = {
    'admin': '마스터',
    'manager': '장비관리자',
    'staff': '담당자'
  };
  
  const data = users.map(u => ({
    "이름": u.username,
    "실명": u.fullName || "",
    "역할": roleMap[u.role] || u.role,
    "소속팀": teams.find(t => t.id === u.teamId)?.name || "",
    "이메일": u.email || "",
    "연락처": u.phone || "",
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportAssetsToExcel(): Promise<Buffer> {
  const assets = await storage.getAssets();
  const teams = await storage.getTeams();
  const categories = await storage.getCategories();
  const users = await storage.getUsers();
  
  const statusMap: Record<string, string> = {
    'ok': '정상',
    'upcoming': '점검예정',
    'overdue': '점검지연'
  };
  
  const data = assets.map(a => ({
    "장비명": a.name,
    "시리얼번호": a.serialNumber,
    "카테고리": categories.find(c => c.id === a.categoryId)?.name || "",
    "관리팀": teams.find(t => t.id === a.teamId)?.name || "",
    "장비관리자": users.find(u => u.id === a.managerId)?.username || "",
    "사용팀": teams.find(t => t.id === a.usageTeamId)?.name || "",
    "담당자": users.find(u => u.id === a.staffId)?.username || "",
    "점검주기(개월)": a.inspectionCycleMonths,
    "최근점검일": a.lastInspectedDate,
    "다음점검일": a.nextDueDate,
    "상태": statusMap[a.status] || a.status,
    "비고": a.notes || "",
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "장비");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

interface ImportResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
}

export async function importTeamsFromExcel(buffer: Buffer): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const name = row["팀명"]?.toString().trim();
    const contactEmail = row["담당자 이메일"]?.toString().trim();
    const phone = row["연락처"]?.toString().trim() || null;
    
    if (!name) {
      errors.push({ row: rowNum, field: "팀명", message: "필수 항목입니다" });
      continue;
    }
    if (!contactEmail) {
      errors.push({ row: rowNum, field: "담당자 이메일", message: "필수 항목입니다" });
      continue;
    }
    
    try {
      await storage.createTeam({ name, contactEmail, phone });
      successCount++;
    } catch (e: any) {
      errors.push({ row: rowNum, field: "팀명", message: e.message || "등록 실패" });
    }
  }
  
  return {
    success: errors.length === 0,
    successCount,
    errorCount: errors.length,
    errors
  };
}

export async function importCategoriesFromExcel(buffer: Buffer): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  
  const users = await storage.getUsers();
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const name = row["카테고리명"]?.toString().trim();
    const managerName = row["관리자"]?.toString().trim();
    
    if (!name) {
      errors.push({ row: rowNum, field: "카테고리명", message: "필수 항목입니다" });
      continue;
    }
    
    let managerId: string | null = null;
    if (managerName) {
      const manager = users.find(u => u.username === managerName);
      if (!manager) {
        errors.push({ row: rowNum, field: "관리자", message: `'${managerName}' 사용자를 찾을 수 없습니다` });
        continue;
      }
      managerId = manager.id;
    }
    
    try {
      await storage.createCategory({ name, managerId });
      successCount++;
    } catch (e: any) {
      errors.push({ row: rowNum, field: "카테고리명", message: e.message || "등록 실패" });
    }
  }
  
  return {
    success: errors.length === 0,
    successCount,
    errorCount: errors.length,
    errors
  };
}

export async function importUsersFromExcel(buffer: Buffer): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  
  const teams = await storage.getTeams();
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  
  const roleMap: Record<string, string> = {
    '마스터': 'admin',
    '장비관리자': 'manager',
    '담당자': 'staff'
  };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const username = row["이름"]?.toString().trim();
    const fullName = row["실명"]?.toString().trim() || null;
    const roleKor = row["역할"]?.toString().trim();
    const teamName = row["소속팀"]?.toString().trim();
    const email = row["이메일"]?.toString().trim() || null;
    const phone = row["연락처"]?.toString().trim() || null;
    
    if (!username) {
      errors.push({ row: rowNum, field: "이름", message: "필수 항목입니다" });
      continue;
    }
    if (!roleKor) {
      errors.push({ row: rowNum, field: "역할", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "소속팀", message: "필수 항목입니다" });
      continue;
    }
    
    const role = roleMap[roleKor];
    if (!role) {
      errors.push({ row: rowNum, field: "역할", message: `'${roleKor}' 은(는) 유효하지 않습니다. (마스터, 장비관리자, 담당자 중 선택)` });
      continue;
    }
    
    const team = teams.find(t => t.name === teamName);
    if (!team) {
      errors.push({ row: rowNum, field: "소속팀", message: `'${teamName}' 팀을 찾을 수 없습니다` });
      continue;
    }
    
    try {
      await storage.createUser({ username, fullName, role, teamId: team.id, email, phone });
      successCount++;
    } catch (e: any) {
      errors.push({ row: rowNum, field: "이름", message: e.message || "등록 실패" });
    }
  }
  
  return {
    success: errors.length === 0,
    successCount,
    errorCount: errors.length,
    errors
  };
}

export async function importAssetsFromExcel(buffer: Buffer): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  
  const teams = await storage.getTeams();
  const categories = await storage.getCategories();
  const users = await storage.getUsers();
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const name = row["장비명"]?.toString().trim();
    const serialNumber = row["시리얼번호"]?.toString().trim();
    const categoryName = row["카테고리"]?.toString().trim();
    const teamName = row["관리팀"]?.toString().trim();
    const managerName = row["장비관리자"]?.toString().trim();
    const usageTeamName = row["사용팀"]?.toString().trim();
    const staffName = row["담당자"]?.toString().trim();
    const inspectionCycleMonths = parseInt(row["점검주기(개월)"]?.toString() || "0");
    const lastInspectedDate = row["최근점검일"]?.toString().trim();
    const notes = row["비고"]?.toString().trim() || null;
    
    if (!name) {
      errors.push({ row: rowNum, field: "장비명", message: "필수 항목입니다" });
      continue;
    }
    if (!serialNumber) {
      errors.push({ row: rowNum, field: "시리얼번호", message: "필수 항목입니다" });
      continue;
    }
    if (!categoryName) {
      errors.push({ row: rowNum, field: "카테고리", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "관리팀", message: "필수 항목입니다" });
      continue;
    }
    if (!managerName) {
      errors.push({ row: rowNum, field: "장비관리자", message: "필수 항목입니다" });
      continue;
    }
    if (!usageTeamName) {
      errors.push({ row: rowNum, field: "사용팀", message: "필수 항목입니다" });
      continue;
    }
    if (!staffName) {
      errors.push({ row: rowNum, field: "담당자", message: "필수 항목입니다" });
      continue;
    }
    if (!inspectionCycleMonths || inspectionCycleMonths <= 0) {
      errors.push({ row: rowNum, field: "점검주기(개월)", message: "1 이상의 숫자를 입력해주세요" });
      continue;
    }
    if (!lastInspectedDate) {
      errors.push({ row: rowNum, field: "최근점검일", message: "필수 항목입니다 (YYYY-MM-DD 형식)" });
      continue;
    }
    
    const category = categories.find(c => c.name === categoryName);
    if (!category) {
      errors.push({ row: rowNum, field: "카테고리", message: `'${categoryName}' 카테고리를 찾을 수 없습니다` });
      continue;
    }
    
    const team = teams.find(t => t.name === teamName);
    if (!team) {
      errors.push({ row: rowNum, field: "관리팀", message: `'${teamName}' 팀을 찾을 수 없습니다` });
      continue;
    }
    
    const manager = users.find(u => u.username === managerName);
    if (!manager) {
      errors.push({ row: rowNum, field: "장비관리자", message: `'${managerName}' 사용자를 찾을 수 없습니다` });
      continue;
    }
    
    const usageTeam = teams.find(t => t.name === usageTeamName);
    if (!usageTeam) {
      errors.push({ row: rowNum, field: "사용팀", message: `'${usageTeamName}' 팀을 찾을 수 없습니다` });
      continue;
    }
    
    const staff = users.find(u => u.username === staffName);
    if (!staff) {
      errors.push({ row: rowNum, field: "담당자", message: `'${staffName}' 사용자를 찾을 수 없습니다` });
      continue;
    }
    
    try {
      await storage.createAsset({
        name,
        serialNumber,
        categoryId: category.id,
        teamId: team.id,
        managerId: manager.id,
        usageTeamId: usageTeam.id,
        staffId: staff.id,
        inspectionCycleMonths,
        lastInspectedDate,
        notes
      });
      successCount++;
    } catch (e: any) {
      errors.push({ row: rowNum, field: "장비명", message: e.message || "등록 실패" });
    }
  }
  
  return {
    success: errors.length === 0,
    successCount,
    errorCount: errors.length,
    errors
  };
}

export function getTeamTemplate(): Buffer {
  const data = [{ "팀명": "예시팀", "담당자 이메일": "example@email.com", "연락처": "010-1234-5678" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "팀");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getCategoryTemplate(): Buffer {
  const data = [{ "카테고리명": "예시카테고리", "관리자": "관리자이름(선택사항)" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "카테고리");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getUserTemplate(): Buffer {
  const data = [{ "이름": "홍길동", "실명": "", "역할": "담당자", "소속팀": "팀명", "이메일": "email@example.com", "연락처": "010-1234-5678" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getAssetTemplate(): Buffer {
  const data = [{
    "장비명": "예시장비",
    "시리얼번호": "SN-001",
    "카테고리": "카테고리명",
    "관리팀": "관리팀명",
    "장비관리자": "관리자이름",
    "사용팀": "사용팀명",
    "담당자": "담당자이름",
    "점검주기(개월)": 12,
    "최근점검일": "2025-01-01",
    "비고": ""
  }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "장비");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
