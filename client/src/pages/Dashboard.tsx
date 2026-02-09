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
import { AlertTriangle, CheckCircle, Clock, Activity, Shield, Wrench, UserCheck, Gauge, FlaskConical, Truck, Package, Microscope, ClipboardCheck } from "lucide-react";
import { Asset, InspectionLog, User, Category } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { currentUser, currentTeam } = useUser();
  const [, setLocation] = useLocation();

  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => api.assets.getAll(),
  });

  const { data: logs = [] } = useQuery<InspectionLog[]>({
    queryKey: ["/api/logs"],
    queryFn: () => api.logs.getAll(),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => api.categories.getAll(),
  });

  const assets = auth.filterAssetsForUser(allAssets, currentUser);
  
  const totalAssets = assets.length;
  const overdueAssets = assets.filter(a => a.status === 'overdue').length;
  const upcomingAssets = assets.filter(a => a.status === 'upcoming').length;
  const okAssets = assets.filter(a => a.status === 'ok').length;

  const complianceRate = totalAssets > 0 ? Math.round(((totalAssets - overdueAssets) / totalAssets) * 100) : 100;

  const statusData = [
    { name: '정상', value: okAssets, color: '#22c55e' },
    { name: '임박', value: upcomingAssets, color: '#eab308' },
    { name: '지연', value: overdueAssets, color: '#ef4444' },
  ];

  const getManagerIcon = (name: string) => {
    if (name.includes('계량') || name.includes('미터')) return Gauge;
    if (name.includes('시험')) return FlaskConical;
    if (name.includes('검사차량') || name.includes('차량')) return Truck;
    if (name.includes('검사장비') || name.includes('검사')) return ClipboardCheck;
    return Package;
  };

  const categoryData = categories
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      value: assets.filter(a => a.categoryId === cat.id).length,
      icon: getManagerIcon(cat.name),
    }))
    .filter(m => m.value > 0);

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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-3">
          {roleInfo.icon}
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">{roleInfo.title}</h2>
            <p className="text-sm text-muted-foreground hidden sm:block">{roleInfo.description}</p>
          </div>
        </div>
        {currentTeam && (
          <Badge variant="outline" className="sm:ml-auto w-fit">
            {currentTeam.name}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setLocation('/assets')}
        >
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
        
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setLocation('/assets?status=ok')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">점검 준수율</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-ok" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{complianceRate}%</div>
            <p className="text-xs text-muted-foreground">주기 내 점검 완료</p>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setLocation('/assets?status=upcoming')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">점검 임박</CardTitle>
            <Clock className="h-4 w-4 text-status-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAssets}</div>
            <p className="text-xs text-muted-foreground">7일 이내 예정</p>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setLocation('/assets?status=overdue')}
        >
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
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>장비 상태 현황</CardTitle>
              <CardDescription>장비 건전성 분포</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px]">
                <div className="relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ 
                                backgroundColor: 'white', 
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                border: `2px solid ${data.color}`
                              }}>
                                <p style={{ margin: 0, fontWeight: 'bold', color: data.color }}>
                                  {data.name}: {data.value}대
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ height: 200 }}>
                    <div className="text-center">
                      <div className="text-3xl font-bold">{totalAssets}</div>
                      <div className="text-xs text-muted-foreground">전체</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-2 md:gap-4 mt-2">
                  {statusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-2 rounded-lg" style={{ backgroundColor: `${item.color}15` }}>
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs md:text-sm font-medium" style={{ color: item.color }}>{item.name}</span>
                      <span className="text-xs md:text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>장비 구분별 분포</CardTitle>
              <CardDescription>구분별 장비 수</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryData.length > 0 ? (
                  categoryData.map((item) => {
                    const IconComponent = item.icon;
                    const maxValue = Math.max(...categoryData.map(m => m.value));
                    const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                    return (
                      <div 
                        key={item.id} 
                        className="space-y-2 cursor-pointer hover:bg-accent/50 p-2 rounded-lg transition-colors -mx-2"
                        onClick={() => setLocation(`/assets?category=${item.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <IconComponent className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <span className="text-lg font-bold text-primary">{item.value}개</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    장비 구분 데이터가 없습니다
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
