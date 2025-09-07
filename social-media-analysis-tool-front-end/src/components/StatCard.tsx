import { Card } from "@/components/ui/card";

interface StatCardProps {
    label: string;
    value: string | number;
    delta?: string;
    helpText?: string;
}

export function StatCard({ label, value, delta, helpText }: StatCardProps) {
    return (
        <Card className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{value}</span>
                {delta && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{delta}</span>}
            </div>
            {helpText && <p className="text-xs text-muted-foreground leading-tight">{helpText}</p>}
        </Card>
    );
}
