import DashboardCard from "@/components/DashboardCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
    return (
        <div className="p-6 space-y-6">
            <DashboardCard title="API Credentials">
                <div className="grid gap-4 md:grid-cols-2">
                    <Input placeholder="Facebook Token" />
                    <Input placeholder="Instagram Token" />
                    <Button className="md:col-span-2">Save Tokens</Button>
                </div>
            </DashboardCard>
            <DashboardCard title="Preferences">
                <div className="space-y-4 text-sm">
                    <label className="flex items-center justify-between gap-4">
                        <span>Enable dark mode</span>
                        <Switch />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                        <span>Auto-refresh dashboard</span>
                        <Switch />
                    </label>
                </div>
            </DashboardCard>
        </div>
    );
}
