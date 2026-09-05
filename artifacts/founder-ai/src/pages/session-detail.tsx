import { Layout } from "@/components/layout";
import {
  useGetSession,
  getGetSessionQueryKey,
  useListMemories,
  getListMemoriesQueryKey,
  getGetDashboardStatsQueryKey,
  getBaseUrl,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Play, Terminal, Target, FileText, Code,
  CheckCircle2, AlertCircle, Loader2, GitMerge, Copy,
  ExternalLink, BrainCircuit, RefreshCw, Square, ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  agent: string;
  message: string;
  ts: number;
}

const AGENT_META: Record<string, { label: string; color: string; dot: string }> = {
  orchestrator:  { label: "Orchestrator",    color: "text-blue-400",    dot: "bg-blue-500" },
  research:      { label: "Market Research", color: "text-purple-400",  dot: "bg-purple-500" },
  businessPlan:  { label: "Business Plan",   color: "text-emerald-400", dot: "bg-emerald-500" },
  mvpBuilder:    { label: "MVP Builder",     color: "text-orange-400",  dot: "bg-orange-500" },
};

export default function SessionDetail() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  // Keep a ref to the SSE reader so Stop can abort it immediately.
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const apiPath = (path: string) => `${getBaseUrl() ?? ""}${path}`;

  const { data: session, isLoading, isError } = useGetSession(id, {
    query: {
      enabled: !!id,
      queryKey: getGetSessionQueryKey(id),
      refetchInterval: isRunning ? 2000 : 5000,
    },
  });

  const { data: memories } = useListMemories(
    { sessionId: id },
    {
      query: {
        enabled: !!id && activeTab === "memory",
        queryKey: getListMemoriesQueryKey({ sessionId: id }),
      },
    }
  );

  useEffect(() => {
    if (session?.status === "running") setIsRunning(true);
    else if (session?.status === "completed" || session?.status === "failed") setIsRunning(false);
  }, [session?.status]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logOpen) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logOpen]);

  const handleRunAgents = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setLogs([]);
    setLogOpen(true);
    toast({ title: "Agents Starting", description: "FounderAI is initializing all agents..." });

    try {
      const response = await fetch(apiPath(`/api/sessions/${id}/run`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to start agents");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream available");
      readerRef.current = reader;

      const decoder = new TextDecoder();
      // Buffer for partial SSE frames that arrive across multiple chunks.
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Split on newlines but keep the incomplete last piece in the buffer.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "log") {
              setLogs((prev) => [...prev, { agent: data.agent, message: data.message, ts: data.ts ?? Date.now() }]);
              continue;
            }

            queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });

            if (data.type === "error") {
              setErrorMessage(data.message ?? "An agent failed. You can retry.");
            }
            if (data.type === "completed") {
              toast({ title: "Analysis Complete ✓", description: "All 4 agents finished successfully!" });
              // Refresh dashboard so totals update immediately.
              queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
            }
          } catch {
            // Ignore JSON parse errors on partial/malformed frames.
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Agent run failed";
      // DOMException AbortError happens when the reader is cancelled via Stop — not a real failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMessage(msg);
      toast({ title: "Run Failed", description: msg, variant: "destructive" });
    } finally {
      readerRef.current = null;
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      // Cancel the SSE reader immediately so the UI stops waiting.
      readerRef.current?.cancel().catch(() => {});
      readerRef.current = null;

      await fetch(apiPath(`/api/sessions/${id}/stop`), { method: "POST" });
      toast({ title: "Stopped", description: "Agent run was stopped." });
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
    } catch {
      toast({ title: "Error", description: "Failed to stop the run.", variant: "destructive" });
    } finally {
      setIsStopping(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Copied to clipboard" });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p>Loading session data...</p>
        </div>
      </Layout>
    );
  }

  if (isError || !session) {
    return (
      <Layout>
        <div className="p-8 border border-destructive/20 bg-destructive/5 rounded-lg text-center mt-8">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">Failed to load session details.</p>
        </div>
      </Layout>
    );
  }

  const agents = [
    { id: "orchestrator", name: "Orchestrator",    icon: Terminal, color: "text-blue-500" },
    { id: "research",     name: "Market Research", icon: Target,   color: "text-purple-500" },
    { id: "businessPlan", name: "Business Plan",   icon: FileText, color: "text-primary" },
    { id: "mvpBuilder",   name: "MVP Builder",     icon: Code,     color: "text-[#FC6D26]" },
  ] as const;

  const isFailed   = session.status === "failed";
  const isCompleted = session.status === "completed";
  const showLogs = logs.length > 0;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{session.title || "Untitled Project"}</h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              <span className="text-primary font-bold">ID:</span> {session.id.substring(0, 8)}...
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isRunning && (
              <Button
                onClick={handleStop}
                disabled={isStopping}
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                {isStopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                Stop
              </Button>
            )}

            {isFailed && !isRunning && (
              <Button
                onClick={handleRunAgents}
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Failed Agents
              </Button>
            )}

            <Button
              onClick={handleRunAgents}
              disabled={isRunning || isCompleted}
              className={`${isRunning ? "bg-secondary" : "bg-primary"} text-primary-foreground font-semibold px-6 shadow-[0_0_20px_rgba(0,237,100,0.15)]`}
            >
              {isRunning ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agents Active</>
              ) : isCompleted ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" /> Run Complete</>
              ) : (
                <><Play className="mr-2 h-4 w-4" /> Initialize Agents</>
              )}
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {(errorMessage || isFailed) && !isRunning && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Agent run failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                {errorMessage ?? "One or more agents encountered an error. Completed agents will be skipped on retry."}
              </p>
            </div>
            <Button size="sm" onClick={handleRunAgents} className="shrink-0 bg-primary text-primary-foreground">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card border border-border w-full justify-start p-1 h-auto mb-6">
            <TabsTrigger value="overview"  className="data-[state=active]:bg-accent data-[state=active]:text-foreground py-2 px-4">Command Center</TabsTrigger>
            <TabsTrigger value="results"   className="data-[state=active]:bg-accent data-[state=active]:text-foreground py-2 px-4" disabled={!session.orchestratorResult && !session.researchResult}>Analysis Results</TabsTrigger>
            <TabsTrigger value="memory"    className="data-[state=active]:bg-accent data-[state=active]:text-foreground py-2 px-4 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" /> Session Memory
            </TabsTrigger>
          </TabsList>

          {/* ── COMMAND CENTER ── */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Startup Thesis</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="font-serif text-lg leading-relaxed text-foreground/90">{session.idea}</p>
              </CardContent>
            </Card>

            {/* Agent cards */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {agents.map((agent) => {
                const status = (session.agentProgress as Record<string, string>)?.[agent.id] || "pending";
                const Icon = agent.icon;
                return (
                  <Card
                    key={agent.id}
                    className={`bg-card border-border overflow-hidden transition-all ${
                      status === "running" ? "ring-1 ring-secondary border-secondary shadow-[0_0_15px_rgba(100,100,255,0.2)]" :
                      status === "failed"  ? "ring-1 ring-destructive/40 border-destructive/30" : ""
                    }`}
                  >
                    <div className="p-5 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-md bg-background ${agent.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <StatusBadge status={status} isAgent={true} />
                      </div>
                      <h3 className="font-semibold text-foreground">{agent.name}</h3>
                      <div className="mt-auto pt-4">
                        {status === "pending" && <p className="text-xs text-muted-foreground font-mono">Awaiting initialization...</p>}
                        {status === "running" && (
                          <div className="flex items-center gap-2 text-xs text-secondary font-mono animate-pulse">
                            <Activity className="h-3 w-3" />
                            {(() => {
                              const last = [...logs].reverse().find(l => l.agent === agent.id);
                              return last ? last.message.slice(0, 40) + (last.message.length > 40 ? "…" : "") : "Processing...";
                            })()}
                          </div>
                        )}
                        {status === "done" && (
                          <p className="text-xs text-primary font-mono flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Complete
                          </p>
                        )}
                        {status === "failed" && (
                          <p className="text-xs text-destructive font-mono flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Failed — will retry
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* ── LIVE LOG PANEL ── */}
            {showLogs && (
              <Card className="bg-card border-border overflow-hidden">
                <button
                  onClick={() => setLogOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-3 border-b border-border/50 hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Agent Live Log</span>
                    {isRunning && (
                      <span className="flex items-center gap-1 text-xs text-secondary font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse inline-block" />
                        live
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{logs.length} entries</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${logOpen ? "rotate-180" : ""}`} />
                </button>

                {logOpen && (
                  <div className="bg-[#0a0e17] h-72 overflow-y-auto font-mono text-xs p-4 space-y-0.5">
                    {logs.map((entry, i) => {
                      const meta = AGENT_META[entry.agent] ?? { label: entry.agent, color: "text-gray-400", dot: "bg-gray-500" };
                      const time = new Date(entry.ts).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                      return (
                        <div key={i} className="flex gap-2 leading-5 group">
                          <span className="text-muted-foreground/40 shrink-0 select-none">{time}</span>
                          <span className={`shrink-0 ${meta.color} font-semibold w-28 truncate`}>[{meta.label}]</span>
                          <span className="text-green-300/90 break-all">{entry.message}</span>
                        </div>
                      );
                    })}
                    {isRunning && (
                      <div className="flex gap-2 leading-5 animate-pulse">
                        <span className="text-muted-foreground/40 select-none">──────</span>
                        <span className="text-muted-foreground/50">waiting for next event...</span>
                      </div>
                    )}
                    <div ref={logEndRef} />
                  </div>
                )}
              </Card>
            )}

            {/* GitLab card */}
            {session.gitlabUrl && (
              <Card className="bg-card border-[#FC6D26]/30 overflow-hidden">
                <div className="bg-[#FC6D26]/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FC6D26]/20">
                  <div className="flex items-center gap-3">
                    <GitMerge className="h-6 w-6 text-[#FC6D26]" />
                    <div>
                      <h3 className="font-semibold text-foreground">MVP Repository Generated</h3>
                      <p className="text-sm text-muted-foreground">GitLab repository with generated code</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <code className="text-xs bg-background px-3 py-2 rounded border border-border flex-1 sm:flex-none truncate max-w-[200px] sm:max-w-xs text-muted-foreground">
                      {session.gitlabUrl}
                    </code>
                    <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyToClipboard(session.gitlabUrl!)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={session.gitlabUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" className="bg-[#FC6D26] hover:bg-[#FC6D26]/90 text-white shrink-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── ANALYSIS RESULTS ── */}
          <TabsContent value="results" className="mt-0">
            <div className="grid gap-6">
              {session.orchestratorResult && (
                <ResultCard title="Orchestrator Plan"           icon={<Terminal className="h-5 w-5 text-blue-500" />}   data={session.orchestratorResult} />
              )}
              {session.researchResult && (
                <ResultCard title="Market Research"            icon={<Target   className="h-5 w-5 text-purple-500" />} data={session.researchResult} />
              )}
              {session.businessPlanResult && (
                <ResultCard title="Business Plan"              icon={<FileText className="h-5 w-5 text-primary" />}     data={session.businessPlanResult} />
              )}
              {session.mvpResult && (
                <ResultCard title="Technical Architecture & MVP" icon={<Code  className="h-5 w-5 text-[#FC6D26]" />}   data={session.mvpResult} />
              )}
            </div>
          </TabsContent>

          {/* ── SESSION MEMORY ── */}
          <TabsContent value="memory" className="mt-0">
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" /> Stored Insights
                </CardTitle>
                <CardDescription>Knowledge extracted and saved to MongoDB vector database during this session.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!memories || memories.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground font-mono text-sm">
                    No memories recorded yet for this session.
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border/50">
                      {memories.map((memory) => (
                        <div key={memory.id} className="p-6 hover:bg-accent/30 transition-colors">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/30 text-primary bg-primary/5">
                              {memory.type.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="font-serif text-sm leading-relaxed text-foreground/90">{memory.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function ResultCard({ title, icon, data }: { title: string; icon: React.ReactNode; data: unknown }) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="bg-accent/30 border-b border-border/50 py-3 flex flex-row items-center gap-3 space-y-0">
        {icon}
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-max max-h-[400px] w-full bg-[#0d1117] p-4 text-xs font-mono">
          <pre className="text-green-400">{JSON.stringify(data, null, 2)}</pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
