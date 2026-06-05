import { Layout } from "@/components/layout";
import { useListSessions, getListSessionsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { formatDistanceToNow } from "date-fns";
import { Activity, Plus, Search, Table as TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SessionsList() {
  const { data: sessions, isLoading, isError } = useListSessions({
    query: {
      queryKey: getListSessionsQueryKey()
    }
  });

  const [search, setSearch] = useState("");

  const filteredSessions = sessions?.filter(s => 
    s.title?.toLowerCase().includes(search.toLowerCase()) || 
    s.idea?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <TableIcon className="h-7 w-7 text-primary" />
              Startup Analyses
            </h1>
            <p className="text-muted-foreground mt-1">All generated startup plans and technical architectures.</p>
          </div>
          <Link href="/sessions/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              New Analysis
            </Button>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col h-[calc(100vh-12rem)]">
          <div className="p-4 border-b border-border flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search ideas or titles..." 
                className="pl-9 bg-background/50 border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              {filteredSessions.length} sessions
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
                  <Activity className="h-8 w-8 text-primary" />
                  <p>Loading sessions...</p>
                </div>
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center h-full p-8 text-center">
                <div className="max-w-md space-y-4">
                  <Activity className="h-12 w-12 text-destructive mx-auto" />
                  <p className="text-destructive font-medium">Failed to load sessions.</p>
                </div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground">
                <div className="max-w-md space-y-4">
                  <Search className="h-12 w-12 mx-auto opacity-20" />
                  {search ? (
                    <p>No sessions match your search.</p>
                  ) : (
                    <div className="space-y-4">
                      <p>No sessions found. Your command center is empty.</p>
                      <Link href="/sessions/new">
                        <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
                          Initialize your first startup
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredSessions.map((session) => (
                  <Link key={session.id} href={`/sessions/${session.id}`} className="block hover:bg-accent/50 transition-colors p-4 group">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {session.title || "Untitled Project"}
                          </h3>
                          <StatusBadge status={session.status} />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-3xl font-serif">
                          {session.idea}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Mini progress indicators */}
                          {['orchestrator', 'research', 'businessPlan', 'mvpBuilder'].map(agent => {
                            const status = (session.agentProgress as Record<string, string>)?.[agent];
                            return (
                              <div 
                                key={agent} 
                                className={`w-2 h-2 rounded-full ${
                                  status === 'done' || status === 'completed' ? 'bg-primary' :
                                  status === 'running' ? 'bg-secondary animate-pulse' :
                                  status === 'failed' ? 'bg-destructive' : 'bg-muted border border-border'
                                }`} 
                                title={`${agent}: ${status || 'pending'}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
