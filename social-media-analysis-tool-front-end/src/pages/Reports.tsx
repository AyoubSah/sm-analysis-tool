import DashboardCard from "@/components/DashboardCard";
import { Button } from "@/components/ui/button";
import { useExportsStore, type ExportRecord } from "@/store/useExportsStore";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ReportsPage() {
  const exportsList = useExportsStore((s) => s.exports);
  const removeExport = useExportsStore((s) => s.removeExport);
  const clearExports = useExportsStore((s) => s.clearExports);

  const download = (rec: ExportRecord) => {
    // Use stored data URL to trigger download
    const a = document.createElement("a");
    a.href = rec.dataUrl;
    a.download = rec.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const typeLabel = (t: ExportRecord["type"]) =>
    t === "pdf"
      ? "PDF"
      : t === "comments_csv"
      ? "Comments CSV"
      : "Categories CSV";

  return (
    <div className="p-6 space-y-6">
      <DashboardCard title="Recent Generated Reports">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {exportsList.length} item{exportsList.length === 1 ? "" : "s"}
          </div>
          {exportsList.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all exports?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All generated PDFs and CSVs
                    will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      clearExports();
                      toast.success("All exports deleted");
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        {exportsList.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No exports yet. Generate a PDF on the Dashboard or export CSVs to
            see them here.
          </div>
        ) : (
          <ul className="text-sm divide-y">
            {exportsList.map((rec) => (
              <li
                key={rec.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      className="text-primary underline underline-offset-2 truncate"
                      title={rec.filename}
                      onClick={() => download(rec)}
                    >
                      {rec.filename}
                    </button>
                    <Badge variant="secondary">{typeLabel(rec.type)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(rec.createdAt).toLocaleString()} •{" "}
                    {(rec.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => download(rec)}
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      removeExport(rec.id);
                      toast.success("Export deleted");
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}
