import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusProps = {
  status: "pending" | "running" | "completed" | "failed" | string | undefined | null;
  className?: string;
  isAgent?: boolean;
};

export function StatusBadge({ status, className, isAgent = false }: StatusProps) {
  if (!status) return null;

  const normalized = status.toLowerCase();
  
  if (normalized === "pending") {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground bg-muted/20 font-mono text-xs", className)}>
        Pending
      </Badge>
    );
  }
  
  if (normalized === "running") {
    return (
      <Badge variant="outline" className={cn("text-secondary border-secondary/30 bg-secondary/10 font-mono text-xs animate-pulse", className)}>
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-secondary inline-block"></span>
        Running
      </Badge>
    );
  }

  if (normalized === "done" || normalized === "completed") {
    return (
      <Badge variant="outline" className={cn("text-primary border-primary/30 bg-primary/10 font-mono text-xs", className)}>
        {isAgent ? "Done" : "Completed"}
      </Badge>
    );
  }

  if (normalized === "failed") {
    return (
      <Badge variant="outline" className={cn("text-destructive border-destructive/30 bg-destructive/10 font-mono text-xs", className)}>
        Failed
      </Badge>
    );
  }

  return <Badge variant="outline" className={cn("font-mono text-xs", className)}>{status}</Badge>;
}
