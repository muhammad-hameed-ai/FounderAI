import { Layout } from "@/components/layout";
import { useListMemories, getListMemoriesQueryKey, useRecallMemory } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BrainCircuit, Calendar, Link as LinkIcon, Database, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { MemoryRecord } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export default function MemoryExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemoryRecord[] | null>(null);
  const { toast } = useToast();
  
  const recallMemory = useRecallMemory();
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const { data: recentMemories, isLoading: isLoadingRecent } = useListMemories(
    { limit: 20 },
    { query: { queryKey: getListMemoriesQueryKey({ limit: 20 }) } }
  );

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults(null);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      recallMemory.mutate(
        { data: { query: searchQuery, limit: 10 } },
        {
          onSuccess: (data) => {
            setSearchResults(data);
            setIsSearching(false);
          },
          onError: () => {
            toast({
              title: "Search failed",
              description: "Could not connect to MongoDB vector search.",
              variant: "destructive"
            });
            setIsSearching(false);
          }
        }
      );
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, recallMemory, toast]);

  const displayMemories = searchResults !== null ? searchResults : recentMemories;
  const isLoading = searchResults !== null ? isSearching : isLoadingRecent;

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Database className="h-7 w-7 text-secondary" />
              Memory Explorer
            </h1>
            <p className="text-muted-foreground mt-1">
              Search through the AI's collective knowledge across all sessions using MongoDB Vector Search.
            </p>
          </div>
        </div>

        <Card className="bg-card/50 border-primary/20 shadow-[0_0_15px_rgba(0,0,0,0.2)]">
          <CardContent className="p-6">
            <div className="relative flex items-center">
              <Search className={`absolute left-4 h-5 w-5 ${isSearching ? 'text-secondary animate-pulse' : 'text-muted-foreground'}`} />
              <Input
                placeholder="Ask your co-founder anything (e.g. 'competitors in AI healthcare' or 'marketing strategies')"
                className="pl-12 h-14 text-lg bg-background/80 border-border/60 focus-visible:ring-secondary/50 font-serif"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults !== null && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="absolute right-2 text-xs"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults(null);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {searchResults !== null && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground font-mono">
                <span>Vector search results for "{searchQuery}"</span>
                <span>{searchResults.length} matches</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            {searchResults !== null ? "Search Results" : "Recent Knowledge"}
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-card border-border/50 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 w-24 bg-muted rounded mb-4" />
                    <div className="h-4 w-full bg-muted rounded mb-2" />
                    <div className="h-4 w-3/4 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !displayMemories || displayMemories.length === 0 ? (
            <div className="p-12 border border-dashed border-border/50 rounded-lg text-center text-muted-foreground bg-card/20">
              <BrainCircuit className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg">No memories found.</p>
              <p className="text-sm mt-2">The AI builds knowledge as it runs analyses.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {displayMemories.map((memory, index) => (
                <Card 
                  key={memory.id} 
                  className="bg-card border-border shadow-sm hover:border-border/80 transition-colors animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase tracking-wider text-[10px]">
                        {memory.type.replace('_', ' ')}
                      </Badge>
                      {memory.score && (
                        <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20 text-[10px] font-mono">
                          Match: {(memory.score * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="text-sm md:text-base text-foreground font-serif leading-relaxed mb-4">
                      {memory.content.length > 300 
                        ? `${memory.content.substring(0, 300)}...` 
                        : memory.content}
                    </div>
                    
                    <div className="flex justify-end pt-4 border-t border-border/50">
                      <Link href={`/sessions/${memory.sessionId}`}>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary group">
                          <LinkIcon className="h-3 w-3 mr-2" />
                          View Source Session
                          <ArrowRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
