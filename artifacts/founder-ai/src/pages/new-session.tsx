import { Layout } from "@/components/layout";
import { useCreateSession, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  idea: z.string().min(10, {
    message: "Idea must be at least 10 characters.",
  }),
});

export default function NewSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSession = useCreateSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      idea: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createSession.mutate({ data: { idea: values.idea } }, {
      onSuccess: (session) => {
        // Refresh dashboard totals so the new session count is accurate.
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({
          title: "Session created",
          description: "Your startup idea is ready for analysis.",
        });
        setLocation(`/sessions/${session.id}`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create session. Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-6 border border-primary/20">
            <Sparkles className="h-4 w-4" />
            <span>Initialize Co-Founder</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">What are we building?</h1>
          <p className="text-lg text-muted-foreground font-serif italic">
            Describe your startup idea in detail — the more context you give, the smarter the analysis. Include target audience, core problem, and potential revenue models if you have them.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="idea"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g. A marketplace for unused compute power targeting AI researchers. We charge a 5% transaction fee..." 
                      className="min-h-[250px] text-lg bg-card/50 border-border/60 focus-visible:ring-primary/50 resize-y p-6 leading-relaxed"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-destructive font-mono text-sm" />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button 
                type="submit" 
                size="lg"
                disabled={createSession.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-8 text-base shadow-[0_0_30px_rgba(0,237,100,0.2)] hover:shadow-[0_0_40px_rgba(0,237,100,0.3)] transition-all group"
              >
                {createSession.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    Start Analysis
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
