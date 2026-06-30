import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, FileText, X, Copy, Download, Save, Check, Upload, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface DocumentationGeneratorPanelProps {
  brandId?: string;
  onClose: () => void;
}

interface DocumentationTemplate {
  id: string;
  template_name: string;
  doc_category: string;
  output_format: string;
  sections_template: string[];
  system_prompt: string;
}

interface DocumentationResult {
  title: string;
  overview: string;
  sections: Array<{
    heading: string;
    content: string;
    code_examples?: string[];
  }>;
  mermaid_diagram?: string;
  related_docs?: string[];
}

export function DocumentationGeneratorPanel({ brandId, onClose }: DocumentationGeneratorPanelProps) {
  const { toast } = useToast();
  
  // Input state
  const [codeInput, setCodeInput] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Configuration state
  const [docType, setDocType] = useState<string>("component");
  const [outputFormat, setOutputFormat] = useState<string>("markdown");
  const [verbosity, setVerbosity] = useState<string>("standard");
  const [targetAudience, setTargetAudience] = useState<string>("developers");
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includeDiagrams, setIncludeDiagrams] = useState(false);
  const [saveToKnowledgeBase, setSaveToKnowledgeBase] = useState(false);
  
  // Result state
  const [result, setResult] = useState<{
    documentation: DocumentationResult;
    formatted_output: string;
    meta: {
      response_time_ms: number;
      tokens_used: number;
      template_used: string | null;
    };
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["documentation-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentation_templates")
        .select("id, template_name, doc_category, output_format, sections_template, system_prompt")
        .eq("is_active", true)
        .order("template_name");
      if (error) throw error;
      return (data || []) as DocumentationTemplate[];
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("documentation-generator-agent", {
        body: {
          code_input: codeInput,
          template_id: selectedTemplateId || undefined,
          doc_type: docType,
          output_format: outputFormat,
          verbosity,
          target_audience: targetAudience,
          include_examples: includeExamples,
          include_diagrams: includeDiagrams,
          brand_id: brandId,
          save_to_knowledge_base: saveToKnowledgeBase,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Generation failed');
      return data;
    },
    onSuccess: (data) => {
      setResult({
        documentation: data.documentation,
        formatted_output: data.formatted_output,
        meta: data.meta,
      });
      toast({ title: "Documentation generated", description: `Completed in ${data.meta.response_time_ms}ms` });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async () => {
    if (result?.formatted_output) {
      await navigator.clipboard.writeText(result.formatted_output);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (result?.formatted_output && result?.documentation) {
      const extension = outputFormat === 'html' ? 'html' : 'md';
      const blob = new Blob([result.formatted_output], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.documentation.title.toLowerCase().replace(/\s+/g, '-')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded successfully" });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCodeInput(content);
        toast({ title: "File loaded", description: file.name });
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    setResult(null);
    setCopied(false);
  };

  const codeStats = {
    lines: codeInput.split('\n').length,
    characters: codeInput.length,
  };

  // Update doc type when template is selected
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setDocType(template.doc_category);
      if (template.output_format) {
        setOutputFormat(template.output_format);
      }
    }
  };

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-400">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Documentation Generator</CardTitle>
              <CardDescription>
                Generate comprehensive documentation from code
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {result ? (
          <div className="space-y-4">
            {/* Results header */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{result.meta.tokens_used} tokens</Badge>
                <Badge variant="outline">{result.meta.response_time_ms}ms</Badge>
                {result.meta.template_used && (
                  <Badge variant="secondary">{result.meta.template_used}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Generate New
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>

            {/* Results content */}
            <Tabs defaultValue="preview" className="w-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="raw">Raw Output</TabsTrigger>
                <TabsTrigger value="json">JSON Structure</TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="mt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-muted/30 max-h-[600px] overflow-y-auto">
                  <ReactMarkdown>{result.formatted_output}</ReactMarkdown>
                </div>
              </TabsContent>
              
              <TabsContent value="raw" className="mt-4">
                <pre className="text-xs p-4 rounded-lg bg-muted overflow-x-auto max-h-[600px] overflow-y-auto font-mono">
                  {result.formatted_output}
                </pre>
              </TabsContent>
              
              <TabsContent value="json" className="mt-4">
                <pre className="text-xs p-4 rounded-lg bg-muted overflow-x-auto max-h-[600px] overflow-y-auto font-mono">
                  {JSON.stringify(result.documentation, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Code Input Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Code Input</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {codeStats.lines} lines | {codeStats.characters} chars
                  </span>
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".ts,.tsx,.js,.jsx,.py,.md,.json,.yaml,.yml"
                      onChange={handleFileUpload}
                    />
                    <Button variant="outline" size="sm" asChild className="cursor-pointer">
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              <Textarea
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Paste your code here..."
                className="font-mono text-sm min-h-[200px] resize-y"
              />
            </div>

            {/* Template Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Template (Optional)</Label>
              {isLoadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading templates...
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedTemplateId === template.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{template.template_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {template.doc_category}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Configuration Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Doc Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">API Reference</SelectItem>
                    <SelectItem value="component">Component</SelectItem>
                    <SelectItem value="architecture">Architecture</SelectItem>
                    <SelectItem value="setup">Setup Guide</SelectItem>
                    <SelectItem value="readme">README</SelectItem>
                    <SelectItem value="jsdoc">JSDoc</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="changelog">Changelog</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Output Format</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="jsdoc">JSDoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Verbosity</Label>
                <Select value={verbosity} onValueChange={setVerbosity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={targetAudience} onValueChange={setTargetAudience}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="developers">Developers</SelectItem>
                    <SelectItem value="beginners">Beginners</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="internal">Internal Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="flex flex-wrap gap-6 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-examples"
                  checked={includeExamples}
                  onCheckedChange={setIncludeExamples}
                />
                <Label htmlFor="include-examples" className="text-sm cursor-pointer">
                  Include code examples
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="include-diagrams"
                  checked={includeDiagrams}
                  onCheckedChange={setIncludeDiagrams}
                />
                <Label htmlFor="include-diagrams" className="text-sm cursor-pointer">
                  Include Mermaid diagrams
                </Label>
              </div>

              {brandId && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="save-kb"
                    checked={saveToKnowledgeBase}
                    onCheckedChange={setSaveToKnowledgeBase}
                  />
                  <Label htmlFor="save-kb" className="text-sm cursor-pointer">
                    Save to Knowledge Base
                  </Label>
                </div>
              )}
            </div>

            {/* What this does */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium mb-1">What this agent will do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Analyze code structure and patterns</li>
                <li>Generate structured documentation with required sections</li>
                <li>Create code examples and usage patterns</li>
                <li>Optionally generate architecture diagrams</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !codeInput.trim()}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Code className="mr-2 h-4 w-4" />
                    Generate Documentation
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
