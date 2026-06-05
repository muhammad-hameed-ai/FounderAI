import { Layout } from "@/components/layout";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, GitMerge, FileText, Activity } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetDashboardStats({
    query: {
      queryKey: getGetDashboardStatsQueryKey(),
    }
  });

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Command Center</h1>
            <p className="text-muted-foreground">Overview of your AI co-founder's activities.</p>
          </div>
          <Link 
            href="/sessions/new" 
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-[0_0_20px_rgba(0,237,100,0.15)] flex items-center gap-2"
          >
            New Analysis
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isError || !stats ? (
          <div className="p-8 border border-destructive/20 bg-destructive/5 rounded-lg text-center">
            <Activity className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-destructive font-medium">Failed to load dashboard stats.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total Sessions" 
                value={stats.totalSessions} 
                icon={<Activity className="h-4 w-4 text-muted-foreground" />} 
              />
              <StatCard 
                title="Analyses Completed" 
                value={stats.completedSessions} 
                icon={<FileText className="h-4 w-4 text-primary" />} 
              />
              <StatCard 
                title="Insights Memorized" 
                value={stats.totalMemories} 
                icon={<BrainCircuit className="h-4 w-4 text-secondary" />} 
              />
              <StatCard 
                title="Repos Generated" 
                value={stats.gitlabRepos || 0} 
                icon={<GitMerge className="h-4 w-4 text-[#FC6D26]" />} 
              />
            </div>

            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Recent Activity
              </h2>
              
              <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                {stats.recentSessions && stats.recentSessions.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {stats.recentSessions.map((session) => (
                      <Link key={session.id} href={`/sessions/${session.id}`} className="block hover:bg-accent/50 transition-colors p-4 group">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {session.title || "Untitled Project"}
                              </h3>
                              <StatusBadge status={session.status} />
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1 max-w-2xl font-serif italic">
                              "{session.idea}"
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No sessions found. Start a new analysis to see activity here.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <Card className="bg-card border-border/50 shadow-sm hover:border-border transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-mono tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
