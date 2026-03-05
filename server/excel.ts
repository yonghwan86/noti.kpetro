import * as XLSX from "xlsx";
import { storage } from "./storage";
import type { Team, User, Asset, AssetHistory } from "@shared/schema";
import { format } from "date-fns";

export async function exportTeamsToExcel(): Promise<Buffer> {
  const teams = await storage.getTeams();
  
  const data = teams.map(t => ({
    "구분": t.type === 'management' ? '관리팀' : '사용자',
    "팀명": t.name,
    "팀장 이메일": t.contactEmail,
    "팀장 전화번호": t.phone || "",
    "담당자 이메일": t.staffEmail || "",
    "담당자 전화번호": t.staffPhone || "",
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
    "구분명": c.name,
    "기본 주기": c.defaultCycleDays || "",
    "구분 관리자": (c.managerIds || []).map(mid => users.find(u => u.id === mid)?.username).filter(Boolean).join(", ") || "",
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "구분");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportUsersToExcel(): Promise<Buffer> {
  const users = await storage.getUsers();
  const teams = await storage.getTeams();
  
  const managerUsers = users.filter(u => u.role === 'manager');
  
  const data = managerUsers.map(u => {
    const team = teams.find(t => t.id === u.teamId);
    return {
      "이름": u.username,
      "부서": team?.department || "",
      "소속팀": team?.name || "",
      "이메일": u.email || "",
      "전화번호": u.phone || "",
    };
  });
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "관리자");
  
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportAssetsToExcel(): Promise<Buffer> {
  const assets = await storage.getAssets();
  const teams = await storage.getTeams();
  const users = await storage.getUsers();
  const categories = await storage.getCategories();
  
  const statusMap: Record<string, string> = {
    'ok': '정상',
    'upcoming': '점검예정',
    'overdue': '점검지연'
  };
  
  const data = assets.map(a => {
    const team = teams.find(t => t.id === a.teamId);
    return {
      "대상": a.name,
      "시리얼번호": a.serialNumber,
      "구분": categories.find(c => c.id === a.categoryId)?.name || "",
      "담당자": users.find(u => u.id === a.staffId)?.username || "",
      "부서": team?.department || "",
      "담당팀": team?.name || "",
      "사용팀": teams.find(t => t.id === a.usageTeamId)?.name || "",
      "점검주기(일)": a.inspectionCycleDays,
      "최근점검일": a.lastInspectedDate,
      "다음점검일": a.nextDueDate,
      "상태": statusMap[a.status] || a.status,
      "추가정보": a.notes || "",
    };
  });
  
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
  managerUpdateCount?: number;
  updateCount?: number;
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
    const phone = (row["팀장 전화번호"] || row["연락처"])?.toString().trim() || null;
    const staffEmail = row["담당자 이메일"]?.toString().trim() || null;
    const staffPhone = row["담당자 전화번호"]?.toString().trim() || null;
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
    
    const name = (row["구분명"] || row["장비 구분명"] || row["카테고리명"])?.toString().trim();
    const defaultCycleDaysRaw = row["기본 주기"]?.toString().trim();
    const defaultCycleDays = defaultCycleDaysRaw ? parseInt(defaultCycleDaysRaw) : undefined;
    const managerName = (row["구분 관리자"] || row["관리자"])?.toString().trim();
    
    if (!name) {
      errors.push({ row: rowNum, field: "구분명", message: "필수 항목입니다" });
      continue;
    }
    
    let managerIds: string[] = [];
    if (managerName) {
      const managerNames = managerName.split(",").map((n: string) => n.trim()).filter(Boolean);
      for (const mName of managerNames) {
        const manager = users.find(u => u.username === mName);
        if (!manager) {
          errors.push({ row: rowNum, field: "구분 관리자", message: `'${mName}' 사용자를 찾을 수 없습니다` });
          continue;
        }
        managerIds.push(manager.id);
      }
    }
    
    try {
      await storage.createCategory({ name, managerIds, defaultCycleDays: defaultCycleDays && defaultCycleDays > 0 ? defaultCycleDays : undefined });
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
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const username = row["이름"]?.toString().trim();
    const departmentName = row["부서"]?.toString().trim() || null;
    const teamName = row["소속팀"]?.toString().trim();
    const email = row["이메일"]?.toString().trim() || null;
    const phone = (row["전화번호"] || row["연락처"])?.toString().trim() || null;
    
    if (!username) {
      errors.push({ row: rowNum, field: "이름", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "소속팀", message: "필수 항목입니다" });
      continue;
    }
    
    let team = teams.find(t => t.name === teamName && (!departmentName || t.department === departmentName));
    if (!team) {
      try {
        team = await storage.createTeam({
          name: teamName,
          department: departmentName,
          type: 'usage',
        });
        teams.push(team);
      } catch (e: any) {
        errors.push({ row: rowNum, field: "소속팀", message: `팀 생성 실패: ${e.message}` });
        continue;
      }
    }
    
    try {
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        await storage.updateUser(existingUser.id, { teamId: team.id, email, phone });
        successCount++;
      } else {
        await storage.createUser({ username, fullName: username, role: 'manager', teamId: team.id, email, phone });
        successCount++;
      }
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
  const users = await storage.getUsers();
  const categories = await storage.getCategories();
  const existingAssets = await storage.getAssets();
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  let updateCount = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    
    const name = (row["대상"] || row["장비명"])?.toString().trim();
    const serialNumber = row["시리얼번호"]?.toString().trim();
    const categoryName = (row["구분"] || row["장비 구분"] || row["카테고리"])?.toString().trim();
    const staffName = row["담당자"]?.toString().trim();
    const departmentName = row["부서"]?.toString().trim() || null;
    const teamName = (row["담당팀"] || row["관리팀"])?.toString().trim();
    const usageTeamName = row["사용팀"]?.toString().trim();
    const inspectionCycleDays = parseInt(row["점검주기(일)"]?.toString() || row["점검주기(개월)"]?.toString() || "0");
    const lastInspectedDate = row["최근점검일"]?.toString().trim();
    const notes = (row["추가정보"] || row["비고"])?.toString().trim() || null;
    
    if (!name) {
      errors.push({ row: rowNum, field: "대상", message: "필수 항목입니다" });
      continue;
    }
    if (!serialNumber) {
      errors.push({ row: rowNum, field: "시리얼번호", message: "필수 항목입니다" });
      continue;
    }
    if (!categoryName) {
      errors.push({ row: rowNum, field: "구분", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "담당팀", message: "필수 항목입니다" });
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
    
    const team = teams.find(t => t.name === teamName && (!departmentName || t.department === departmentName));
    if (!team) {
      errors.push({ row: rowNum, field: "담당팀", message: `'${teamName}' 팀을 찾을 수 없습니다` });
      continue;
    }
    
    const category = categories.find(c => c.name === categoryName);
    if (!category) {
      errors.push({ row: rowNum, field: "구분", message: `'${categoryName}' 구분을 찾을 수 없습니다` });
      continue;
    }
    
    if (!category.managerIds || category.managerIds.length === 0) {
      errors.push({ row: rowNum, field: "구분", message: `'${categoryName}' 구분에 관리자가 지정되지 않았습니다` });
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
    
    const existingAsset = existingAssets.find(a => a.serialNumber === serialNumber);
    
    try {
      if (existingAsset) {
        const updates: any = {
          name,
          categoryId: category.id,
          teamId: team.id,
          managerId: category.managerIds![0],
          usageTeamId: usageTeam.id,
          staffId: staff.id,
          notes,
        };
        if (inspectionCycleDays && inspectionCycleDays > 0) {
          updates.inspectionCycleDays = inspectionCycleDays;
        }
        if (lastInspectedDate) {
          updates.lastInspectedDate = lastInspectedDate;
        }
        await storage.updateAsset(existingAsset.id, updates);
        updateCount++;
        successCount++;
      } else {
        if (!inspectionCycleDays || inspectionCycleDays <= 0) {
          errors.push({ row: rowNum, field: "점검주기(일)", message: "1 이상의 숫자를 입력해주세요" });
          continue;
        }
        if (!lastInspectedDate) {
          errors.push({ row: rowNum, field: "최근점검일", message: "필수 항목입니다 (YYYY-MM-DD 형식)" });
          continue;
        }
        await storage.createAsset({
          name,
          serialNumber,
          categoryId: category.id,
          teamId: team.id,
          managerId: category.managerIds![0],
          usageTeamId: usageTeam.id,
          staffId: staff.id,
          inspectionCycleDays,
          lastInspectedDate,
          notes
        });
        successCount++;
      }
    } catch (e: any) {
      errors.push({ row: rowNum, field: "대상", message: e.message || "등록 실패" });
    }
  }
  
  return {
    success: errors.length === 0,
    successCount,
    errorCount: errors.length,
    errors,
    updateCount
  };
}

export function getTeamTemplate(): Buffer {
  const data = [{ "구분": "관리팀", "팀명": "예시팀", "팀장 이메일": "leader@email.com", "팀장 전화번호": "010-1234-5678", "담당자 이메일": "staff@email.com", "담당자 전화번호": "010-5678-1234" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "팀");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getCategoryTemplate(): Buffer {
  const data = [{ "구분명": "예시구분", "기본 주기": 7, "구분 관리자": "관리자이름" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "구분");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getUserTemplate(): Buffer {
  const data = [{ "이름": "홍길동", "부서": "부서명", "소속팀": "팀명", "이메일": "email@example.com", "전화번호": "010-1234-5678" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function exportStaffUsersToExcel(managerId?: string): Promise<Buffer> {
  const users = await storage.getUsers();
  const teams = await storage.getTeams();
  const categories = await storage.getCategories();
  let staffUsers = users.filter(u => u.role === 'staff');
  if (managerId) {
    staffUsers = staffUsers.filter(u => u.managerId === managerId);
  }

  const data = staffUsers.map(u => {
    const team = teams.find(t => t.id === u.teamId);
    return {
      "이름": u.username,
      "직책": u.position || "",
      "부서": team?.department || "",
      "소속팀": team?.name || "",
      "이메일": u.email || "",
      "전화번호": u.phone || "",
      "구분": (u.assignedCategoryIds || []).map(cid => categories.find(c => c.id === cid)?.name).filter(Boolean).join(", ") || "",
      "로그인 상태": u.passwordHash ? "설정완료" : (u.email ? "미설정" : "이메일없음"),
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function importStaffUsersFromExcel(buffer: Buffer, managerId?: string): Promise<ImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

  const teams = await storage.getTeams();
  const categories = await storage.getCategories();
  const errors: ImportResult["errors"] = [];
  let successCount = 0;
  let managerUpdateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const username = row["이름"]?.toString().trim();
    const position = row["직책"]?.toString().trim() || null;
    const departmentName = row["부서"]?.toString().trim() || null;
    const teamName = row["소속팀"]?.toString().trim();
    const email = row["이메일"]?.toString().trim() || null;
    const phone = (row["전화번호"] || row["연락처"])?.toString().trim() || null;
    const categoryName = (row["구분"] || row["배정 구분"] || row["배정 대상"])?.toString().trim() || null;

    if (!username) {
      errors.push({ row: rowNum, field: "이름", message: "필수 항목입니다" });
      continue;
    }
    if (!teamName) {
      errors.push({ row: rowNum, field: "소속팀", message: "필수 항목입니다" });
      continue;
    }

    let team = teams.find(t => t.name === teamName && (!departmentName || t.department === departmentName));
    if (!team) {
      try {
        team = await storage.createTeam({
          name: teamName,
          department: departmentName,
          type: 'usage',
        });
        // Update teams list so subsequent rows can find it
        teams.push(team);
      } catch (e: any) {
        errors.push({ row: rowNum, field: "소속팀", message: `팀 생성 실패: ${e.message}` });
        continue;
      }
    }

    let assignCategoryId: string | null = null;
    if (categoryName) {
      const cat = categories.find(c => c.name === categoryName);
      if (!cat) {
        errors.push({ row: rowNum, field: "배정 구분", message: `'${categoryName}' 구분을 찾을 수 없습니다` });
        continue;
      }
      assignCategoryId = cat.id;
    }

    try {
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        const updateData: any = { teamId: team.id, email, phone, position };
        if (managerId) {
          updateData.managerId = managerId;
        }
        if (assignCategoryId) {
          const existing = existingUser.assignedCategoryIds || [];
          if (!existing.includes(assignCategoryId)) {
            updateData.assignedCategoryIds = [...existing, assignCategoryId];
          }
        }
        await storage.updateUser(existingUser.id, updateData);
        if (existingUser.role === 'manager') {
          managerUpdateCount++;
        }
        successCount++;
      } else {
        const newUser = await storage.createUser({
          username, fullName: null, role: 'staff', teamId: team.id, email, phone,
          managerId: managerId || null, position,
          assignedCategoryIds: assignCategoryId ? [assignCategoryId] : [],
        });
        successCount++;
      }
    } catch (e: any) {
      errors.push({ row: rowNum, field: "이름", message: e.message || "등록 실패" });
    }
  }

  return {
    success: errors.length === 0,
    successCount,
    errorCount: errors.length,
    errors,
    managerUpdateCount
  };
}

export function getStaffUserTemplate(): Buffer {
  const data = [{ "이름": "홍길동", "직책": "팀장", "부서": "부서명", "소속팀": "팀명", "구분": "계량기", "이메일": "email@example.com", "전화번호": "010-1234-5678" }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function getAssetTemplate(): Buffer {
  const data = [{
    "대상": "예시대상",
    "시리얼번호": "SN-001",
    "구분": "구분명",
    "담당자": "담당자이름",
    "부서": "부서명",
    "담당팀": "담당팀명",
    "사용팀": "사용팀명",
    "점검주기(개월)": 12,
    "최근점검일": "2025-01-01",
    "추가정보": ""
  }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "장비");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  'created': '신규 등록',
  'updated': '정보 수정',
  'inspected': '점검 수행',
  'suspended': '중단',
  'resumed': '재개',
  'staff_changed': '담당자 변경',
  'manager_changed': '관리자 변경',
};

export async function exportAssetHistoryToExcel(assetId?: string, categoryId?: string): Promise<Buffer> {
  let history: AssetHistory[];
  if (assetId) {
    history = await storage.getAssetHistoryByAsset(assetId);
  } else if (categoryId) {
    history = await storage.getAssetHistoryByCategory(categoryId);
  } else {
    history = await storage.getAllAssetHistory();
  }

  const allAssets = await storage.getAssets();
  const users = await storage.getUsers();
  const categories = await storage.getCategories();
  const teams = await storage.getTeams();

  const data = history.map(h => {
    const asset = allAssets.find(a => a.id === h.assetId);
    const user = users.find(u => u.id === h.userId);
    const category = asset ? categories.find(c => c.id === asset.categoryId) : null;
    const userTeam = user ? teams.find(t => t.id === user.teamId) : null;

    return {
      "일자": h.date ? format(new Date(h.date), 'yyyy-MM-dd HH:mm') : '-',
      "구분": category?.name || '-',
      "명칭": asset?.name || '-',
      "추가정보": asset?.serialNumber || '-',
      "추가정보2": asset?.notes || '-',
      "변경 유형": CHANGE_TYPE_LABELS[h.changeType] || h.changeType,
      "변경 항목": h.fieldName || '-',
      "이전 값": h.oldValue || '-',
      "변경 값": h.newValue || '-',
      "수행자": user?.username || '-',
      "부서": userTeam?.department || '-',
      "소속팀": userTeam?.name || '-',
      "비고": h.notes || '-',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ "일자": "", "구분": "", "명칭": "", "추가정보": "", "추가정보2": "", "변경 유형": "", "변경 항목": "", "이전 값": "", "변경 값": "", "수행자": "", "부서": "", "소속팀": "", "비고": "" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "이력");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
