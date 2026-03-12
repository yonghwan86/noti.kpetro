import { useState, useMemo } from "react";
import { Team, User } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown, X, Search, Building, Users, User as UserIcon, Zap
} from "lucide-react";

interface ShareTargetSelectorProps {
  teams: Team[];
  users: User[];
  selectedTeamIds: string[];
  selectedUserIds: string[];
  onTeamIdsChange: (ids: string[]) => void;
  onUserIdsChange: (ids: string[]) => void;
  currentUserTeamId?: string;
  currentUserDepartment?: string | null;
}

interface DeptGroup {
  department: string;
  teams: (Team & { members: User[] })[];
}

export default function ShareTargetSelector({
  teams,
  users,
  selectedTeamIds,
  selectedUserIds,
  onTeamIdsChange,
  onUserIdsChange,
  currentUserTeamId,
  currentUserDepartment,
}: ShareTargetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const tree = useMemo(() => {
    const deptMap = new Map<string, (Team & { members: User[] })[]>();
    const noDeptTeams: (Team & { members: User[] })[] = [];

    for (const team of teams) {
      const members = users.filter(u => u.teamId === team.id);
      const teamWithMembers = { ...team, members };
      const dept = team.department || '';
      if (dept) {
        if (!deptMap.has(dept)) deptMap.set(dept, []);
        deptMap.get(dept)!.push(teamWithMembers);
      } else {
        noDeptTeams.push(teamWithMembers);
      }
    }

    const groups: DeptGroup[] = [];
    for (const [department, deptTeams] of deptMap) {
      groups.push({ department, teams: deptTeams });
    }
    groups.sort((a, b) => a.department.localeCompare(b.department));

    return { groups, noDeptTeams };
  }, [teams, users]);

  const matchesSearch = (text: string) => {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.toLowerCase());
  };

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;

    const filteredGroups = tree.groups.map(group => {
      const filteredTeams = group.teams.map(team => ({
        ...team,
        members: team.members.filter(m => matchesSearch(m.username)),
      })).filter(team => matchesSearch(team.name) || team.members.length > 0);

      return { ...group, teams: filteredTeams };
    }).filter(group => matchesSearch(group.department) || group.teams.length > 0);

    const filteredNoDept = tree.noDeptTeams.map(team => ({
      ...team,
      members: team.members.filter(m => matchesSearch(m.username)),
    })).filter(team => matchesSearch(team.name) || team.members.length > 0);

    return { groups: filteredGroups, noDeptTeams: filteredNoDept };
  }, [tree, search]);

  const toggleTeam = (teamId: string) => {
    onTeamIdsChange(
      selectedTeamIds.includes(teamId)
        ? selectedTeamIds.filter(id => id !== teamId)
        : [...selectedTeamIds, teamId]
    );
  };

  const toggleUser = (userId: string) => {
    onUserIdsChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter(id => id !== userId)
        : [...selectedUserIds, userId]
    );
  };

  const toggleDepartment = (deptTeams: Team[]) => {
    const deptTeamIds = deptTeams.map(t => t.id);
    const allSelected = deptTeamIds.every(id => selectedTeamIds.includes(id));
    if (allSelected) {
      onTeamIdsChange(selectedTeamIds.filter(id => !deptTeamIds.includes(id)));
    } else {
      const newIds = new Set([...selectedTeamIds, ...deptTeamIds]);
      onTeamIdsChange(Array.from(newIds));
    }
  };

  const selectMyTeam = () => {
    if (!currentUserTeamId) return;
    if (!selectedTeamIds.includes(currentUserTeamId)) {
      onTeamIdsChange([...selectedTeamIds, currentUserTeamId]);
    }
  };

  const selectMyDepartment = () => {
    if (!currentUserDepartment) return;
    const deptTeamIds = teams
      .filter(t => t.department === currentUserDepartment)
      .map(t => t.id);
    const newIds = new Set([...selectedTeamIds, ...deptTeamIds]);
    onTeamIdsChange(Array.from(newIds));
  };

  const selectedItems = useMemo(() => {
    const items: { type: 'team' | 'user'; id: string; label: string }[] = [];
    for (const id of selectedTeamIds) {
      const team = teams.find(t => t.id === id);
      if (team) items.push({ type: 'team', id, label: team.name });
    }
    for (const id of selectedUserIds) {
      const user = users.find(u => u.id === id);
      if (user) items.push({ type: 'user', id, label: user.username });
    }
    return items;
  }, [selectedTeamIds, selectedUserIds, teams, users]);

  const removeItem = (type: 'team' | 'user', id: string) => {
    if (type === 'team') {
      onTeamIdsChange(selectedTeamIds.filter(tid => tid !== id));
    } else {
      onUserIdsChange(selectedUserIds.filter(uid => uid !== id));
    }
  };

  const myTeam = teams.find(t => t.id === currentUserTeamId);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            data-testid="share-target-trigger"
          >
            <span className="text-sm truncate">
              {selectedItems.length === 0
                ? '공유 대상 선택...'
                : `${selectedItems.length}개 선택됨`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 space-y-2">
            <div className="flex gap-1.5">
              {currentUserTeamId && myTeam && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={selectMyTeam}
                  data-testid="quick-my-team"
                >
                  <Zap className="h-3 w-3" />
                  내 팀 ({myTeam.name})
                </Button>
              )}
              {currentUserDepartment && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={selectMyDepartment}
                  data-testid="quick-my-dept"
                >
                  <Zap className="h-3 w-3" />
                  내 부서 ({currentUserDepartment})
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="부서, 팀, 사용자 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="share-target-search"
              />
            </div>
          </div>

          <ScrollArea className="max-h-64">
            <div className="p-2 pt-0 space-y-1">
              {filteredTree.groups.map(group => {
                const deptTeamIds = group.teams.map(t => t.id);
                const allTeamsSelected = deptTeamIds.every(id => selectedTeamIds.includes(id));
                const someTeamsSelected = deptTeamIds.some(id => selectedTeamIds.includes(id));

                return (
                  <div key={group.department} className="space-y-0.5">
                    <div
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleDepartment(group.teams)}
                      data-testid={`dept-${group.department}`}
                    >
                      <Checkbox
                        checked={allTeamsSelected}
                        className={someTeamsSelected && !allTeamsSelected ? 'opacity-50' : ''}
                      />
                      <Building className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                      <span className="text-sm font-medium">{group.department}</span>
                    </div>

                    {group.teams.map(team => (
                      <div key={team.id} className="pl-4 space-y-0.5">
                        <div
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleTeam(team.id)}
                          data-testid={`team-${team.id}`}
                        >
                          <Checkbox checked={selectedTeamIds.includes(team.id)} />
                          <Users className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                          <span className="text-sm">{team.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{team.members.length}명</span>
                        </div>

                        {team.members.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 py-1 px-2 pl-6 rounded hover:bg-accent cursor-pointer"
                            onClick={() => toggleUser(member.id)}
                            data-testid={`user-${member.id}`}
                          >
                            <Checkbox checked={selectedUserIds.includes(member.id)} />
                            <UserIcon className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-sm">{member.username}</span>
                            {member.position && (
                              <span className="text-xs text-muted-foreground">{member.position}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}

              {filteredTree.noDeptTeams.map(team => (
                <div key={team.id} className="space-y-0.5">
                  <div
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent cursor-pointer"
                    onClick={() => toggleTeam(team.id)}
                    data-testid={`team-${team.id}`}
                  >
                    <Checkbox checked={selectedTeamIds.includes(team.id)} />
                    <Users className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-sm">{team.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{team.members.length}명</span>
                  </div>

                  {team.members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 py-1 px-2 pl-4 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleUser(member.id)}
                      data-testid={`user-${member.id}`}
                    >
                      <Checkbox checked={selectedUserIds.includes(member.id)} />
                      <UserIcon className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{member.username}</span>
                      {member.position && (
                        <span className="text-xs text-muted-foreground">{member.position}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {filteredTree.groups.length === 0 && filteredTree.noDeptTeams.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="selected-share-targets">
          {selectedItems.map(item => (
            <Badge
              key={`${item.type}-${item.id}`}
              variant="secondary"
              className="text-xs gap-1 pr-1"
            >
              {item.type === 'team' ? (
                <Users className="h-3 w-3 text-blue-500" />
              ) : (
                <UserIcon className="h-3 w-3 text-green-500" />
              )}
              {item.label}
              <button
                onClick={() => removeItem(item.type, item.id)}
                className="ml-0.5 hover:bg-muted rounded-full p-0.5"
                data-testid={`remove-${item.type}-${item.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
