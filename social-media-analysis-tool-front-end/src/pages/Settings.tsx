import DashboardCard from "@/components/DashboardCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const savedKey = useSettingsStore((s) => s.graph_api_key);
  const savedPage = useSettingsStore((s) => s.page);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const [graph_api_key, setGraphApiKey] = useState("");
  const [page, setPage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGraphApiKey(savedKey || "");
    setPage(savedPage || "");
  }, [savedKey, savedPage]);

  const handleSave = async () => {
    setSaving(true);
    try {
      setSettings({ graph_api_key, page });
      toast.success("Settings saved", {
        description: "Token and Page ID updated.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <DashboardCard title="API Credentials">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Access Token"
            value={graph_api_key}
            onChange={(e) => setGraphApiKey(e.target.value)}
          />
          <Input
            placeholder="Page ID or URL"
            value={page}
            onChange={(e) => setPage(e.target.value)}
          />
          <Button
            className="md:col-span-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DashboardCard>
      <DashboardCard title="Preferences">
        <div className="space-y-4 text-sm">
          <label className="flex items-center justify-between gap-4">
            <span>Enable dark mode</span>
            <Switch
              checked={isDark}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
            />
          </label>
        </div>
      </DashboardCard>
    </div>
  );
}
