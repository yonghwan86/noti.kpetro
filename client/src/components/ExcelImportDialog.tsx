import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
  managerUpdateCount?: number;
  updateCount?: number;
  removedCount?: number;
}

interface ExcelImportDialogProps {
  title: string;
  description: string;
  templateUrl: string;
  importUrl: string;
  onSuccess: () => void;
}

export default function ExcelImportDialog({
  title,
  description,
  templateUrl,
  importUrl,
  onSuccess,
}: ExcelImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(importUrl, {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setResult({
          success: false,
          successCount: 0,
          errorCount: 1,
          errors: [{ row: 0, field: "", message: data.error || "서버 오류가 발생했습니다" }],
        });
        return;
      }
      
      const normalizedResult: ImportResult = {
        success: data.success ?? false,
        successCount: data.successCount ?? 0,
        errorCount: data.errorCount ?? (data.errors?.length ?? 0),
        errors: Array.isArray(data.errors) ? data.errors : [],
        managerUpdateCount: data.managerUpdateCount ?? 0,
        removedCount: data.removedCount ?? 0,
      };
      
      setResult(normalizedResult);

      if (normalizedResult.success || normalizedResult.successCount > 0) {
        onSuccess();
      }
    } catch (error) {
      setResult({
        success: false,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, field: "", message: "파일 처리 중 오류가 발생했습니다" }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          엑셀 업로드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Button variant="link" asChild className="p-0 h-auto">
              <a href={templateUrl} download className="flex items-center gap-1 text-sm">
                <Download className="h-4 w-4" />
                양식 다운로드
              </a>
            </Button>
            <span className="text-sm text-muted-foreground">
              (먼저 양식을 다운받아 작성 후 업로드하세요)
            </span>
          </div>

          <div className="space-y-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              data-testid="input-excel-file"
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                선택된 파일: {file.name}
              </p>
            )}
          </div>

          {result && (
            <div className="space-y-2">
              {result.successCount > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    {result.successCount}건이 성공적으로 처리되었습니다.
                    {(result.updateCount ?? 0) > 0 && (
                      <div className="text-xs mt-1 text-muted-foreground">
                        (이 중 {result.updateCount}건은 기존 데이터가 업데이트되었습니다.)
                      </div>
                    )}
                    {(result.managerUpdateCount ?? 0) > 0 && (
                      <div className="text-xs mt-1 text-muted-foreground">
                        (이 중 구분 관리자 {result.managerUpdateCount}명의 정보가 업데이트되었습니다. 역할은 유지됩니다.)
                      </div>
                    )}
                    {(result.removedCount ?? 0) > 0 && (
                      <div className="text-xs mt-1 text-muted-foreground">
                        (엑셀에 없는 기존 담당자 {result.removedCount}명이 해당 구분에서 배정 해제되었습니다.)
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">{result.errorCount}건의 오류가 발생했습니다:</div>
                    <ul className="list-disc list-inside text-sm max-h-32 overflow-auto">
                      {result.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          {err.row > 0 ? `${err.row}행` : ""} {err.field}: {err.message}
                        </li>
                      ))}
                      {result.errors.length > 10 && (
                        <li>... 외 {result.errors.length - 10}건</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            닫기
          </Button>
          <Button onClick={handleImport} disabled={!file || loading} data-testid="button-import">
            {loading ? "처리중..." : "업로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
