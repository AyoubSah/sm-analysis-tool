import DashboardCard from "@/components/DashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ReportsPage() {
    return (
        <div className="p-6 space-y-6">
            <DashboardCard title="Generate Report">
                <p className="text-sm text-muted-foreground">Select date range & format then export a static snapshot of current analytics. (UI only demo)</p>
                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                    <Input placeholder="Start Date" />
                    <Input placeholder="End Date" />
                    <div className="flex gap-2">
                        <Button className="flex-1">PDF</Button>
                        <Button variant="outline" className="flex-1">Excel</Button>
                    </div>
                </div>
            </DashboardCard>
            <DashboardCard title="Recent Generated Reports">
                <ul className="text-sm list-disc pl-4 space-y-1">
                    <li>2025-08-01 Monthly Overview (PDF)</li>
                    <li>2025-07-01 Monthly Overview (XLSX)</li>
                    <li>2025-Q2 Quarterly Insights (PDF)</li>
                </ul>
            </DashboardCard>
        </div>
    );
}
