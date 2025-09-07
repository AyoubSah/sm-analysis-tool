import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
    SidebarProvider,
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarInset,
    SidebarTrigger,
    SidebarFooter,
    SidebarSeparator,
    SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart2, PieChart, Settings, Home, FileText } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import * as React from "react";

interface NavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
}

const navItems: NavItem[] = [
    { to: "/", label: "Dashboard", icon: Home },
    { to: "/sentiment", label: "Sentiment", icon: PieChart },
    { to: "/topics", label: "Topics", icon: BarChart2 },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout() {
    const location = useLocation();
    return (
        <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <div className="px-2 py-1.5 flex items-center gap-2 rounded-md bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-sidebar-border/60">
                        <span className="font-semibold tracking-tight">SM Analysis</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Analysis</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navItems.map((item) => (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                                            <NavLink to={item.to} className="flex items-center gap-2">
                                                <item.icon className="size-4" />
                                                <span>{item.label}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarSeparator />
                <SidebarFooter className="mt-auto">
                    <div className="px-2 text-[10px] text-muted-foreground/70 space-y-1">
                        <p className="font-medium uppercase tracking-wide">Status</p>
                        <div className="flex items-center gap-2">
                            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live</span>
                        </div>
                    </div>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            <SidebarInset>
                <div className="flex items-center gap-3 border-b px-4 h-14 bg-gradient-to-r from-background/80 via-background to-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <SidebarTrigger />
                    <div className="flex-1 flex items-center gap-2">
                        <h1 className="font-semibold tracking-tight text-sm md:text-base">Social Media Analysis Tool</h1>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium hidden md:inline">UI Demo</span>
                    </div>
                    <ThemeToggle />
                    <Button size="sm" variant="outline">Help</Button>
                </div>
                <div className={cn("flex-1 overflow-y-auto")}>
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default AppLayout;
