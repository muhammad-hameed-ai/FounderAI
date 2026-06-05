import { Layout } from "@/components/layout";
import { useGetSession, getGetSessionQueryKey, useListMemories, getListMemoriesQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Play, Terminal, Target, FileText, Code, CheckCircle2, AlertCircle, Loader2, GitMerge, Copy, ExternalLink, BrainCircuit, Badge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SessionDetail() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: session, isLoading, isError } = useGetSession(id, {
    query: {
      enabled: !!id,
      queryKey: getGetSessionQueryKey(id),
      refetchInterval: isRunning ? 2000 : false
    }
  });

  const { data: memories } = useListMemories(
    { sessionId: id },
    { 
      query: { 
        enabled: !!id && activeTab === "memory",
        queryKey: getListMemoriesQueryKey({ sessionId: id })
      } 
    }
  );

  useEffect(() => {
    if (session?.status === "running") {
      setIsRunning(true);
    } else if (session?.status === "completed" || session?.status === "failed") {
      setIsRunning(false);
    }
  }, [session?.status]);

  const handleRunAgents = async () => {
    setIsRunning(true);
    toast({
      title: "Agents Started",
      description: "FounderAI command center is now active.",
    });

    try {
      const response = await fetch(`/api/sessions/${id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start agents');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader stream");

      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Invalidate query to trigger refetch of session data
              queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
              
              if (data.status === 'completed' || data.status === 'failed') {
                setIsRunning(false);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Agent run failed:", error);
      setIsRunning(false);
      toast({
        title: "Run Failed",
        description: "An error occurred while running the agents.",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "GitLab URL copied to clipboard",
    });
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
    { id: 'orchestrator', name: 'Orchestrator', icon: Terminal, color: 'text-blue-500' },
    { id: 'research', name: 'Market Research', icon: Target, color: 'text-purple-500' },
    { id: 'businessPlan', name: 'Business Plan', icon: FileText, color: 'text-primary' },
    { id: 'mvpBuilder', name: 'MVP Builder', icon: Code, color: 'text-[#FC6D26]' }
  ] as const;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {session.title || "Untitled Project"}
              </h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
              <span className="text-primary font-bold">ID:</span> {session.id.substring(0, 8)}...
            </p>
          </div>
          
          <Button 
            onClick={handleRunAgents} 
            disabled={isRunning || session.status === 'completed'}
            className={`${isRunning ? 'bg-secondary' : 'bg-primary'} text-primary-foreground font-semibold px-6 shadow-[0_0_20px_rgba(0,237,100,0.15)]`}
          >
            {isRunning ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agents Active</>
            ) : session.status === 'completed' ? (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Run Complete</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Initialize Agents</>
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card border border-border w-full justify-start p-1 h-auto mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-accent data-[state=active]:text-foreground py-2 px-4">Command Center</TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-accent data-[state=active]:text-foreground py-2 px-4" disabled={!session.orchestratorResult && !session.researchResult}>Analysis Results</TabsTrigger>
            <TabsTrigger value="memory" className="data-[state=active]:bg-accent data-[state=active]:text-foreground py-2 px-4 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4" /> Session Memory
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Startup Thesis</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="font-serif text-lg leading-relaxed text-foreground/90">
                  {session.idea}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {agents.map((agent) => {
                const status = (session.agentProgress as Record<string, string>)?.[agent.id] || 'pending';
                const Icon = agent.icon;
                
                return (
                  <Card key={agent.id} className={`bg-card border-border overflow-hidden transition-all ${status === 'running' ? 'ring-1 ring-secondary border-secondary shadow-[0_0_15px_rgba(100,100,255,0.2)]' : ''}`}>
                    <div className="p-5 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-md bg-background ${agent.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <StatusBadge status={status} isAgent={true} />
                      </div>
                      <h3 className="font-semibold text-foreground">{agent.name}</h3>
                      
                      <div className="mt-auto pt-4">
                        {status === 'pending' && <p className="text-xs text-muted-foreground font-mono">Awaiting initialization...</p>}
                        {status === 'running' && (
                          <div className="flex items-center gap-2 text-xs text-secondary font-mono animate-pulse">
                            <Activity className="h-3 w-3" /> Processing data...
                          </div>
                        )}
                        {status === 'done' && <p className="text-xs text-primary font-mono flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Complete</p>}
                        {status === 'failed' && <p className="text-xs text-destructive font-mono flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Error occurred</p>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {session.gitlabUrl && (
              <Card className="bg-card border-[#FC6D26]/30 overflow-hidden">
                <div className="bg-[#FC6D26]/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FC6D26]/20">
                  <div className="flex items-center gap-3">
                    <GitMerge className="h-6 w-6 text-[#FC6D26]" />
                    <div>
                      <h3 className="font-semibold text-foreground">MVP Repository Generated</h3>
                      <p className="text-sm text-muted-foreground">GitLab repository with base code</p>
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

          <TabsContent value="results" className="mt-0">
            <div className="grid gap-6">
              {session.orchestratorResult && (
                <ResultCard title="Orchestrator Plan" icon={<Terminal className="h-5 w-5 text-blue-500" />} data={session.orchestratorResult} />
              )}
              {session.researchResult && (
                <ResultCard title="Market Research" icon={<Target className="h-5 w-5 text-purple-500" />} data={session.researchResult} />
              )}
              {session.businessPlanResult && (
                <ResultCard title="Business Plan" icon={<FileText className="h-5 w-5 text-primary" />} data={session.businessPlanResult} />
              )}
              {session.mvpResult && (
                <ResultCard title="Technical Architecture" icon={<Code className="h-5 w-5 text-[#FC6D26]" />} data={session.mvpResult} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="memory" className="mt-0">
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  Stored Insights
                </CardTitle>
                <CardDescription>Knowledge extracted and saved to vector database during this session.</CardDescription>
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
                              {memory.type.replace('_', ' ')}
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

function ResultCard({ title, icon, data }: { title: string, icon: React.ReactNode, data: any }) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="bg-accent/30 border-b border-border/50 py-3 flex flex-row items-center gap-3 space-y-0">
        {icon}
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-max max-h-[400px] w-full bg-[#0d1117] p-4 text-xs font-mono">
          <pre className="text-green-400">
            {JSON.stringify(data, null, 2)}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
