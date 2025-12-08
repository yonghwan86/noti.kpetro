import { useState } from "react";
import { store, CATEGORIES, TEAMS } from "@/lib/mockData";
import { Asset, AssetStatus } from "@/lib/types";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Filter, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";

// Helper functions defined outside to be accessible by all components in this file
const getTeamName = (id: string) => TEAMS.find(t => t.id === id)?.name || id;
const getCategoryName = (id: string) => CATEGORIES.find(c => c.id === id)?.name || id;

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>(store.getAssets());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const { toast } = useToast();

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AssetStatus) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-status-ok hover:bg-status-ok/90 text-white border-0"><CheckCircle2 className="w-3 h-3 mr-1" /> Normal</Badge>;
      case 'upcoming':
        return <Badge className="bg-status-warning hover:bg-status-warning/90 text-white border-0"><Clock className="w-3 h-3 mr-1" /> Upcoming</Badge>;
      case 'overdue':
        return <Badge className="bg-status-error hover:bg-status-error/90 text-white border-0"><AlertCircle className="w-3 h-3 mr-1" /> Overdue</Badge>;
    }
  };

  const handleInspect = (id: string, date: Date) => {
    const updated = store.updateAssetInspection(id, format(date, 'yyyy-MM-dd'));
    if (updated) {
      setAssets([...store.getAssets()]); // Refresh list
      toast({
        title: "Inspection Recorded",
        description: `Next due date calculated: ${updated.nextDueDate}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assets</h2>
          <p className="text-muted-foreground">Manage and track equipment calibration status.</p>
        </div>
        <AddAssetDialog onAdd={() => setAssets([...store.getAssets()])} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search assets..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ok">Normal</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Last Inspected</TableHead>
              <TableHead>Next Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
               <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No assets found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="font-medium">{asset.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{asset.serialNumber}</div>
                  </TableCell>
                  <TableCell>{getCategoryName(asset.categoryId)}</TableCell>
                  <TableCell>{getTeamName(asset.teamId)}</TableCell>
                  <TableCell>{format(new Date(asset.lastInspectedDate), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">
                    {format(new Date(asset.nextDueDate), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>{getStatusBadge(asset.status)}</TableCell>
                  <TableCell className="text-right">
                    <InspectDialog asset={asset} onInspect={handleInspect} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InspectDialog({ asset, onInspect }: { asset: Asset, onInspect: (id: string, date: Date) => void }) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Inspect</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Inspection</DialogTitle>
          <DialogDescription>
            Update inspection date for <strong>{asset.name}</strong>. Next due date will be calculated automatically based on {asset.inspectionCycleDays} day cycle.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Inspection Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            if (date) {
              onInspect(asset.id, date);
              setOpen(false);
            }
          }}>Confirm Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAssetDialog({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();

  const onSubmit = (data: any) => {
    store.addAsset({
      name: data.name,
      serialNumber: data.serialNumber,
      categoryId: data.categoryId,
      teamId: store.currentUser.teamId, // Assign to current user's team
      inspectionCycleDays: parseInt(data.inspectionCycleDays),
      lastInspectedDate: data.lastInspectedDate,
    });
    onAdd();
    setOpen(false);
    reset();
    toast({ title: "Asset Added", description: "New equipment registered successfully." });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Equipment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Equipment</DialogTitle>
          <DialogDescription>
            Register a new asset for {getTeamName(store.currentUser.teamId)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset Name</Label>
              <Input id="name" {...register("name", { required: true })} placeholder="e.g. Pressure Gauge" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">Serial Number</Label>
              <Input id="serial" {...register("serialNumber", { required: true })} placeholder="SN-12345" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select onValueChange={(v) => register("categoryId").onChange({ target: { value: v, name: "categoryId" } })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle">Cycle (Days)</Label>
              <Input id="cycle" type="number" {...register("inspectionCycleDays", { required: true })} placeholder="30" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastDate">Last Inspection Date</Label>
            <Input id="lastDate" type="date" {...register("lastInspectedDate", { required: true })} />
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit">Create Asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
