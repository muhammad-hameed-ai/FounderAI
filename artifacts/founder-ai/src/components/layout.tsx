import { Link, useLocation } from "wouter";
import { LayoutDashboard, List, PlusCircle, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/sessions", label: "Sessions", icon: List },
    { href: "/sessions/new", label: "New Analysis", icon: PlusCircle },
    { href: "/memory", label: "Memory Explorer", icon: BrainCircuit },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col fixed inset-y-0 z-10">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_15px_rgba(0,237,100,0.4)]">
            FA
          </div>
          <span className="font-semibold text-lg tracking-tight">FounderAI</span>
        </div>
        
        <div className="px-4 py-6 flex-1 flex flex-col gap-2">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Command Center
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-colors", 
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </Link>
            )
          })}
        </div>
        
        <div className="p-4 border-t border-border/50 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            System Online
          </div>
          <div className="opacity-50">MongoDB Vector DB connected</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 pl-8 pr-8 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
