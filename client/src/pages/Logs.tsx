import { store } from "@/lib/mockData";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function Logs() {
  const logs = store.getLogs();
  const assets = store.getAssets();
  const users = store.getUsers();
  const [searchTerm, setSearchTerm] = useState("");

  const getAssetName = (id: string) => assets.find(a => a.id === id)?.name || "삭제된 장비";
  const getUserName = (id: string) => users.find(u => u.id === id)?.username || "Unknown";

  const filteredLogs = logs.filter(log => {
    const assetName = getAssetName(log.assetId).toLowerCase();
    const inspectorName = getUserName(log.inspectorId).toLowerCase();
    const term = searchTerm.toLowerCase();
    
    return assetName.includes(term) || inspectorName.includes(term) || log.notes.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">시스템 활동 로그</h2>
        <p className="text-muted-foreground">
          장비 점검 이력 및 시스템 변경 사항을 조회합니다.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="로그 검색 (장비, 작업자, 내용)..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">일시</TableHead>
                <TableHead className="w-[150px]">작업자</TableHead>
                <TableHead className="w-[200px]">대상 장비</TableHead>
                <TableHead>활동 내용</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.date), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal">
                          {getUserName(log.inspectorId)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getAssetName(log.assetId)}
                    </TableCell>
                    <TableCell>{log.notes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
