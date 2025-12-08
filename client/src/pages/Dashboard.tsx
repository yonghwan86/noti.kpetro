import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { AlertTriangle, CheckCircle, Clock, Activity, Shield, Wrench, UserCheck } from "lucide-react";
import { Asset, Category, InspectionLog, User } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Dashboard() {
  const { currentUser, currentTeam } = useUser();

  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => api.assets.getAll(),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => api.categories.getAll(),
  });

  const { data: logs = [] } = useQuery<InspectionLog[]>({
    queryKey: ["/api/logs"],
    queryFn: () => api.logs.getAll(),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const assets = auth.filterAssetsForUser(allAssets, currentUser);
  
  const totalAssets = assets.length;
  const overdueAssets = assets.filter(a => a.status === 'overdue').length;
  const upcomingAssets = assets.filter(a => a.status === 'upcoming').length;
  const okAssets = assets.filter(a => a.status === 'ok').length;

  const complianceRate = totalAssets > 0 ? Math.round(((totalAssets - overdueAssets) / totalAssets) * 100) : 100;

  const statusData = [
    { name: '정상', value: okAssets, color: 'var(--status-ok)' },
    { name: '임박', value: upcomingAssets, color: 'var(--status-warning)' },
    { name: '지연', value: overdueAssets, color: 'var(--status-error)' },
  ];

  const categoryData = categories.map(cat => ({
    name: cat.name,
    value: assets.filter(a => a.categoryId === cat.id).length,
  })).filter(c => c.value > 0);

  const getUserName = (id: string) => users.find(u => u.id === id)?.username || '알 수 없음';
  const getAssetName = (id: string) => allAssets.find(a => a.id === id)?.name || '알 수 없음';

  const getRoleInfo = () => {
    if (!currentUser) return { icon: null, title: '', description: '' };
    
    switch (currentUser.role) {
      case 'admin':
        return {
          icon: <Shield className="h-6 w-6 text-purple-500" />,
          title: '마스터 대시보드',
          description: '전체 시스템 현황을 확인할 수 있습니다.'
        };
      case 'manager':
        return {
          icon: <Wrench className="h-6 w-6 text-blue-500" />,
          title: '장비 관리자 대시보드',
          description: '내가 관리하는 장비의 현황입니다.'
        };
      case 'staff':
        return {
          icon: <UserCheck className="h-6 w-6 text-green-500" />,
          title: '담당자 대시보드',
          description: '내가 담당하는 장비의 현황입니다.'
        };
      default:
        return { icon: null, title: '대시보드', description: '' };
    }
  };

  const roleInfo = getRoleInfo();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {roleInfo.icon}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{roleInfo.title}</h2>
          <p className="text-muted-foreground">{roleInfo.description}</p>
        </div>
        {currentTeam && (
          <Badge variant="outline" className="ml-auto">
            {currentTeam.name}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {currentUser?.role === 'admin' ? '전체 장비' : '내 장비'}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets}</div>
            <p className="text-xs text-muted-foreground">
              {currentUser?.role === 'admin' ? '전체 팀 합계' : 
               currentUser?.role === 'manager' ? '관리 중인 장비' : '담당 장비'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">점검 준수율</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-ok" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{complianceRate}%</div>
            <p className="text-xs text-muted-foreground">주기 내 점검 완료</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">점검 임박</CardTitle>
            <Clock className="h-4 w-4 text-status-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAssets}</div>
            <p className="text-xs text-muted-foreground">7일 이내 예정</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">점검 지연</CardTitle>
            <AlertTriangle className="h-4 w-4 text-status-error" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-error">{overdueAssets}</div>
            <p className="text-xs text-muted-foreground">즉시 조치 필요</p>
          </CardContent>
        </Card>
      </div>

      {totalAssets === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>장비가 없습니다</CardTitle>
            <CardDescription>
              {currentUser?.role === 'admin' 
                ? '시스템에 등록된 장비가 없습니다. 장비 관리 메뉴에서 새 장비를 등록하세요.'
                : currentUser?.role === 'manager'
                ? '관리 중인 장비가 없습니다. 마스터에게 장비 배정을 요청하세요.'
                : '담당 장비가 없습니다. 장비 관리자에게 장비 배정을 요청하세요.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>장비 상태 현황</CardTitle>
              <CardDescription>장비 건전성 분포</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-4">
                  {statusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-muted-foreground">{item.name} ({item.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>카테고리별 분포</CardTitle>
              <CardDescription>종류별 장비 수</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    카테고리 데이터가 없습니다
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>최근 활동</CardTitle>
          <CardDescription>최신 점검 기록 및 시스템 업데이트</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">아직 활동 기록이 없습니다.</p>
            ) : (
              logs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start gap-4 pb-4 border-b last:border-0 border-border/50">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium">
                      {log.notes}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      장비: {getAssetName(log.assetId)} • 처리자: {getUserName(log.inspectorId)} • {format(new Date(log.date), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
