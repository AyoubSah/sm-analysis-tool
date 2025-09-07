import { Card } from "@/components/ui/card";

interface DashboardCardProps {
    title: string;
    children: React.ReactNode;
}

export default function DashboardCard({ title, children }: DashboardCardProps) {
    return (
        <Card className="p-4 space-y-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            {children}
        </Card>
    );
}
