import * as XLSX from "xlsx";
import { storage } from "./storage";
import type { Team, User, Asset } from "@shared/schema";

export async function exportTeamsToExcel(): Promise<Buffer> {
  const teams = await storage.getTeams();
  
  const data = teams.map(t => ({
    "구분": t.type === 'management' ? '관리팀' : '사용자',
    "팀명": t.name,
    "팀장 이메일": t.contactEmail,
    "팀장 휴대폰": t.phone || "",
    "담당자 이메일": t.staffEmail || "",
    "담당자 휴대폰": t.staffPhone || "",
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
    "장비 구분": u.username,
    "관리자": u.fullName || "",
    "소속팀": teams.find(t => t.id === u.teamId)?.name || "",
    "이메일": u.email || "",
    "휴대폰": u.phone || "",
    "역할": roleMap[u.role] || u.role,
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportAssetsToExcel(): Promise<Buffer> {
  const assets = await storage.getAssets();
  const teams = await storage.getTeams();
  const users = await storage.getUsers();
  
  const statusMap: Record<string, string> = {
    'ok': '정상',
    'upcoming': '점검예정',
    'overdue': '점검지연'
  };
  
  const data = assets.map(a => ({
    "장비명": a.name,
    "시리얼번호": a.serialNumber,
    "장비 구분": users.find(u => u.id === a.managerId)?.username || "",
    "관리팀": teams.find(t => t.id === a.teamId)?.name || "",
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
  
  const typeMap: Record<string, string> = {
    '관리팀': 'management',
    '사용자': 'usage'
  };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const typeLabel = row["구분"]?.toString().trim();
    const name = row["팀명"]?.toString().trim();
    const contactEmail = (row["팀장 이메일"] || row["담당자 이메일"])?.toString().trim();
    const phone = (row["팀장 휴대폰"] || row["연락처"])?.toString().trim() || null;
    const staffEmail = row["담당자 이메일"]?.toString().trim() || null;
    const staffPhone = row["담당자 휴대폰"]?.toString().trim() || null;
    const type = (typeMap[typeLabel || ''] || 'management') as 'management' | 'usage';
    
    if (!name) {
      errors.push({ row: rowNum, field: "팀명", message: "필수 항목입니다" });
      continue;
    }
    if (!contactEmail) {
      errors.push({ row: rowNum, field: "팀장 이메일", message: "필수 항목입니다" });
      continue;
    }
    
    try {
      await storage.createTeam({ name, type, contactEmail, phone, staffEmail, staffPhone });
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
    
    const username = (row["장비 구분"] || row["이름"])?.toString().trim();
    const fullName = (row["관리자"] || row["실명"])?.toString().trim() || null;
    const roleKor = row["역할"]?.toString().trim();
    const teamName = row["소속팀"]?.toString().trim();
    const email = row["이메일"]?.toString().trim() || null;
    const phone = (row["휴대폰"] || row["연락처"])?.toString().trim() || null;
    
    if (!username) {
      errors.push({ row: rowNum, field: "장비 구분", message: "필수 항목입니다" });
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
      errors.push({ row: rowNum, field: "장비 구분", message: e.message || "등록 실패" });
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
  const users = await storage.getUsers();
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const name = row["장비명"]?.toString().trim();
    const serialNumber = row["시리얼번호"]?.toString().trim();
    const managerName = (row["장비 구분"] || row["장비관리자"] || row["카테고리"])?.toString().trim();
    const teamName = row["관리팀"]?.toString().trim();
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
    if (!managerName) {
      errors.push({ row: rowNum, field: "장비 구분", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "관리팀", message: "필수 항목입니다" });
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
    
    const team = teams.find(t => t.name === teamName);
    if (!team) {
      errors.push({ row: rowNum, field: "관리팀", message: `'${teamName}' 팀을 찾을 수 없습니다` });
      continue;
    }
    
    const manager = users.find(u => u.username === managerName);
    if (!manager) {
      errors.push({ row: rowNum, field: "장비 구분", message: `'${managerName}' 장비 구분을 찾을 수 없습니다` });
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
  const data = [{ "구분": "관리팀", "팀명": "예시팀", "팀장 이메일": "leader@email.com", "팀장 휴대폰": "010-1234-5678", "담당자 이메일": "staff@email.com", "담당자 휴대폰": "010-5678-1234" }];
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
  const data = [{ "장비 구분": "계량기", "관리자": "홍길동", "소속팀": "팀명", "이메일": "email@example.com", "휴대폰": "010-1234-5678", "역할": "장비관리자" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportStaffUsersToExcel(): Promise<Buffer> {
  const users = await storage.getUsers();
  const teams = await storage.getTeams();
  const managers = users.filter(u => u.role === 'manager');
  const staffUsers = users.filter(u => u.role === 'staff');

  const data = staffUsers.map(u => ({
    "장비 구분": managers.find(m => m.id === u.managerId)?.username || "",
    "이름": u.username,
    "소속팀": teams.find(t => t.id === u.teamId)?.name || "",
    "이메일": u.email || "",
    "휴대폰": u.phone || "",
    "로그인 상태": u.passwordHash ? "설정완료" : (u.email ? "미설정" : "이메일없음"),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function importStaffUsersFromExcel(buffer: Buffer): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

  const teams = await storage.getTeams();
  const users = await storage.getUsers();
  const managers = users.filter(u => u.role === 'manager');
  const errors: ImportResult["errors"] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const managerName = (row["장비 구분"] || row["장비관리자"])?.toString().trim();
    const username = row["이름"]?.toString().trim();
    const teamName = row["소속팀"]?.toString().trim();
    const email = row["이메일"]?.toString().trim() || null;
    const phone = (row["휴대폰"] || row["연락처"])?.toString().trim() || null;

    if (!username) {
      errors.push({ row: rowNum, field: "이름", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "소속팀", message: "필수 항목입니다" });
      continue;
    }

    const team = teams.find(t => t.name === teamName);
    if (!team) {
      errors.push({ row: rowNum, field: "소속팀", message: `'${teamName}' 팀을 찾을 수 없습니다` });
      continue;
    }

    let managerId: string | null = null;
    if (managerName) {
      const manager = managers.find(m => m.username === managerName);
      if (!manager) {
        errors.push({ row: rowNum, field: "장비 구분", message: `'${managerName}' 장비 구분을 찾을 수 없습니다` });
        continue;
      }
      managerId = manager.id;
    }

    try {
      await storage.createUser({ username, fullName: null, role: 'staff', teamId: team.id, email, phone, managerId });
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

export function getStaffUserTemplate(): Buffer {
  const data = [{ "장비 구분": "계량기", "이름": "홍길동", "소속팀": "팀명", "이메일": "email@example.com", "휴대폰": "010-1234-5678" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getAssetTemplate(): Buffer {
  const data = [{
    "장비명": "예시장비",
    "시리얼번호": "SN-001",
    "장비 구분": "장비 구분명",
    "관리팀": "관리팀명",
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
