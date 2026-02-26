import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, UploadCloud, FolderSync, Database, Trash2, AlertCircle, CheckCircle, Clock, Loader2, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddCategoryModal } from "./AddCategoryModal";
import { AddSourceModal, KnowledgeSourceType } from "./AddSourceModal";
import { SourceFilesSection } from "./SourceFilesSection";
import { GoogleDriveIntegrationTab } from "./GoogleDriveIntegrationTab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DeleteFileDialog } from "@/components/brands/DeleteFileDialog";
interface KnowledgeCategory {
  id: string;
  name: string;
  description: string | null;
  collection_key: string;
  last_synced: string | null;
  is_active: boolean;
}
interface KnowledgeSource {
  id: string;
  category_id: string;
  name: string;
  type: KnowledgeSourceType;
  config: Record<string, unknown> | null;
  is_active: boolean;
  last_synced: string | null;
}
type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface KnowledgeFileRow {
  id: string;
  name: string;
  file_type: string | null;
  is_indexed: boolean;
  last_indexed: string | null;
  metadata: Record<string, unknown> | null;
  embedding_count: number | null;
  processing_status: ProcessingStatus | null;
  last_error: string | null;
  retry_count: number | null;
  error_timestamp: string | null;
  brand_id: string | null;
  knowledge_sources: KnowledgeSource;
  created_at?: string;
  updated_at?: string;
}
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    console.error("Failed to format date", error);
    return value;
  }
};
const humanizeSourceType = (type: KnowledgeSourceType) => {
  switch (type) {
    case "manual":
      return "Manual Upload";
    case "google_drive":
      return "Google Drive";
    case "supabase":
      return "Supabase Storage";
    default:
      return type;
  }
};
const fileTypeLabel = (value: string | null) => {
  if (!value) return "Unknown";
  if (value.includes("pdf")) return "PDF";
  if (value.includes("csv")) return "CSV";
  if (value.includes("spreadsheet")) return "Spreadsheet";
  if (value.includes("presentation")) return "Presentation";
  if (value.includes("document")) return "Document";
  if (value.includes("plain")) return "Text";
  return value;
};

/**
 * Parse error code from error message (format: [KB_XXX] message)
 */
const parseErrorCode = (errorMessage: string): { code: string | null; message: string } => {
  const match = errorMessage.match(/^\[(KB_\d+)\]\s*(.+)$/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: null, message: errorMessage };
};

/**
 * Get user-friendly error explanation based on error code
 */
const getErrorExplanation = (code: string | null, message: string): { title: string; description: string; suggestion: string; isRetryable: boolean } => {
  // Error code mappings for user-friendly display
  const errorExplanations: Record<string, { title: string; description: string; suggestion: string; isRetryable: boolean }> = {
    'KB_201': { title: 'File Not Found', description: 'The uploaded file could not be retrieved from storage.', suggestion: 'Try uploading the file again.', isRetryable: false },
    'KB_202': { title: 'Empty File', description: 'The file appears to be empty or contains no text.', suggestion: 'Please upload a file with text content.', isRetryable: false },
    'KB_203': { title: 'Invalid Content', description: 'The file contains binary data that cannot be processed.', suggestion: 'Please upload a plain text (.txt) or markdown (.md) file.', isRetryable: false },
    'KB_204': { title: 'Processing Error', description: 'Could not split the file into chunks for processing.', suggestion: 'The file may be corrupted. Try uploading a different version.', isRetryable: false },
    'KB_205': { title: 'AI Analysis Failed', description: 'Failed to analyze the file content with the AI service.', suggestion: 'This is usually temporary. Click retry or wait for automatic retry.', isRetryable: true },
    'KB_206': { title: 'Database Error', description: 'Failed to save the processed content to the database.', suggestion: 'This is usually temporary. Click retry or wait for automatic retry.', isRetryable: true },
    'KB_207': { title: 'Timeout', description: 'Processing took too long and was stopped.', suggestion: 'Large files may need more time. The system will automatically retry.', isRetryable: true },
    'KB_208': { title: 'File Too Complex', description: 'The file is too large or complex to process in memory.', suggestion: 'Try splitting the file into smaller parts.', isRetryable: false },
    'KB_301': { title: 'AI Not Configured', description: 'The AI service API key is not configured.', suggestion: 'Contact your administrator to configure the Gemini API key.', isRetryable: false },
    'KB_302': { title: 'Rate Limited', description: 'The AI service is temporarily busy.', suggestion: 'Please wait. The system will automatically retry.', isRetryable: true },
    'KB_303': { title: 'AI Error', description: 'Received an unexpected response from the AI service.', suggestion: 'This is usually temporary. The system will automatically retry.', isRetryable: true },
    'KB_304': { title: 'Network Error', description: 'Could not connect to the AI service.', suggestion: 'Check your internet connection. The system will automatically retry.', isRetryable: true },
    'KB_305': { title: 'Service Unavailable', description: 'The AI service is experiencing issues.', suggestion: 'This is usually temporary. The system will automatically retry.', isRetryable: true },
    'KB_306': { title: 'Quota Exceeded', description: 'AI service quota has been exceeded.', suggestion: 'Contact your administrator to increase the quota.', isRetryable: false },
  };

  if (code && errorExplanations[code]) {
    return errorExplanations[code];
  }

  // Default fallback
  return {
    title: 'Processing Failed',
    description: message || 'An unexpected error occurred.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    isRetryable: true,
  };
};

const StatusBadge = ({ file, onRetry }: { file: KnowledgeFileRow; onRetry?: (fileId: string) => void }) => {
  const status = file.processing_status || 'pending';

  const getProcessingDuration = (updatedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const processingMinutes = file.updated_at ? Math.floor((Date.now() - new Date(file.updated_at).getTime()) / 60000) : 0;
  const isStuck = status === 'processing' && processingMinutes > 5;
  const isCritical = status === 'processing' && processingMinutes > 15;

  const statusConfig = {
    pending: {
      variant: "outline" as const,
      icon: <Clock className="h-3 w-3 mr-1" />,
      label: "Pending",
      className: "border-gray-300 text-gray-600"
    },
    processing: {
      variant: "secondary" as const,
      icon: isStuck ? (isCritical ? <AlertTriangle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />) : <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      label: file.updated_at ? `Processing ${getProcessingDuration(file.updated_at)}` : "Processing",
      className: isCritical ? "border-red-300 bg-red-50 text-red-700" : (isStuck ? "border-yellow-300 bg-yellow-50 text-yellow-700" : "border-blue-300 bg-blue-50 text-blue-700")
    },
    completed: {
      variant: "default" as const,
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
      label: "Indexed",
      className: "bg-green-600"
    },
    failed: {
      variant: "destructive" as const,
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      label: "Failed",
      className: ""
    }
  };

  const config = statusConfig[status];

  if (status === 'failed' && file.last_error) {
    const { code, message } = parseErrorCode(file.last_error);
    const errorInfo = getErrorExplanation(code, message);
    const retriesLeft = 3 - (file.retry_count || 0);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className={`cursor-help ${config.className}`}>
              {config.icon}
              {config.label}
              {file.retry_count && file.retry_count > 0 && ` (${file.retry_count}/3)`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm p-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-destructive">{errorInfo.title}</p>
                  {code && <p className="text-xs text-muted-foreground">Error Code: {code}</p>}
                </div>
              </div>
              <p className="text-sm">{errorInfo.description}</p>
              <div className="flex items-start gap-2 bg-muted/50 p-2 rounded-md">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs">{errorInfo.suggestion}</p>
              </div>
              {file.error_timestamp && (
                <p className="text-xs text-muted-foreground">
                  Failed at: {formatDateTime(file.error_timestamp)}
                </p>
              )}
              {errorInfo.isRetryable && retriesLeft > 0 && onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(file.id);
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-2" />
                  Retry Now ({retriesLeft} attempts left)
                </Button>
              )}
              {!errorInfo.isRetryable && (
                <p className="text-xs text-amber-600 font-medium">
                  This error cannot be automatically retried. Please follow the suggestion above.
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'processing' && isStuck) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className={`cursor-help ${config.className}`}>
              {config.icon}
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-3">
            <div className="space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                {isCritical ? "Possibly Stuck" : "Taking Longer Than Expected"}
              </p>
              <p className="text-sm">
                {isCritical
                  ? "This file has been processing for over 15 minutes. It may be stuck due to a system issue."
                  : "This file is taking longer than expected to process. Large files may need more time."}
              </p>
              {isCritical && (
                <p className="text-xs text-muted-foreground">
                  If the file doesn't complete soon, use the "Clean Up Stuck Files" button to reset it.
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
};
export const KnowledgeBase = () => {
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");
  const [mainTab, setMainTab] = useState("all-brand-files");
  const [activeTab, setActiveTab] = useState("sources");
  const [manualSourceId, setManualSourceId] = useState<string>("");
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [allFilesBrandFilter, setAllFilesBrandFilter] = useState<string>("all");
  const [allFilesSearchTerm, setAllFilesSearchTerm] = useState("");
  const [fileToDelete, setFileToDelete] = useState<{ id: string; file_name: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const {
    data: categories = [],
    isLoading: isLoadingCategories
  } = useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("knowledge_base_categories").select("id, name, description, collection_key, last_synced, is_active").eq("is_active", true).order("name");
      if (error) throw error;
      return data as KnowledgeCategory[];
    }
  });

  // Fetch all brands for filtering
  const {
    data: brands = []
  } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; slug: string }>;
    }
  });
  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);
  const {
    data: sources = [],
    isLoading: isLoadingSources
  } = useQuery({
    queryKey: ["knowledge-sources", selectedCategoryId],
    enabled: Boolean(selectedCategoryId),
    queryFn: async () => {
      if (!selectedCategoryId) return [] as KnowledgeSource[];
      const {
        data,
        error
      } = await supabase.from("knowledge_sources").select("id, category_id, name, type, config, is_active, last_synced").eq("category_id", selectedCategoryId).eq("is_active", true).order("name");
      if (error) throw error;
      return data as KnowledgeSource[];
    }
  });
  const {
    data: files = [],
    isLoading: isLoadingFiles
  } = useQuery({
    queryKey: ["knowledge-files", selectedCategoryId, selectedBrandId],
    enabled: Boolean(selectedCategoryId),
    queryFn: async () => {
      if (!selectedCategoryId) return [] as KnowledgeFileRow[];

      let query = supabase
        .from("knowledge_files")
        .select("id, name, file_type, is_indexed, last_indexed, metadata, embedding_count, processing_status, last_error, retry_count, error_timestamp, brand_id, knowledge_sources!inner(id, category_id, name, type, config, is_active, last_synced)")
        .eq("knowledge_sources.category_id", selectedCategoryId);

      // Apply brand filter
      if (selectedBrandId === "global") {
        query = query.is("brand_id", null);
      } else if (selectedBrandId !== "all") {
        query = query.eq("brand_id", selectedBrandId);
      }

      const { data, error } = await query.order("name");
      if (error) throw error;
      return data as KnowledgeFileRow[];
    }
  });

  // Query for ALL brand files (for the "All Files" view)
  const {
    data: allBrandFiles = [],
    isLoading: isLoadingAllBrandFiles
  } = useQuery({
    queryKey: ["all-brand-knowledge-files", allFilesBrandFilter],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_files")
        .select(`
          id, name, file_type, is_indexed, last_indexed, metadata, embedding_count,
          processing_status, last_error, retry_count, error_timestamp, brand_id,
          uploaded_by, created_at, updated_at,
          knowledge_sources(id, category_id, name, type, config, is_active, last_synced),
          brands(id, name, slug)
        `)
        .not("brand_id", "is", null); // Only get brand-specific files

      // Apply brand filter
      if (allFilesBrandFilter !== "all") {
        query = query.eq("brand_id", allFilesBrandFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: (query) => {
      // Auto-refresh if any files are processing
      const hasProcessingFiles = query.state.data?.some(
        file => file.processing_status === 'pending' || file.processing_status === 'processing'
      );
      return hasProcessingFiles ? 5000 : false;
    }
  });
  const selectedCategory = useMemo(() => categories.find(category => category.id === selectedCategoryId) ?? null, [categories, selectedCategoryId]);
  const manualSources = useMemo(() => sources.filter(source => source.type === "manual"), [sources]);
  useEffect(() => {
    if (manualSources.length === 0) {
      setManualSourceId("");
      return;
    }
    setManualSourceId(current => {
      if (current && manualSources.some(source => source.id === current)) {
        return current;
      }
      return manualSources[0].id;
    });
  }, [manualSources]);
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) return files;
    return files.filter(file => {
      const lower = searchTerm.toLowerCase();
      return file.name.toLowerCase().includes(lower) || humanizeSourceType(file.knowledge_sources.type).toLowerCase().includes(lower) || (file.file_type?.toLowerCase().includes(lower) ?? false);
    });
  }, [files, searchTerm]);

  // Filtered brand files for "All Files" view
  const filteredAllBrandFiles = useMemo(() => {
    if (!allFilesSearchTerm.trim()) return allBrandFiles;
    return allBrandFiles.filter(file => {
      const lower = allFilesSearchTerm.toLowerCase();
      return (
        file.name.toLowerCase().includes(lower) ||
        (file.brands?.name?.toLowerCase().includes(lower) ?? false) ||
        (file.knowledge_sources?.name?.toLowerCase().includes(lower) ?? false) ||
        (file.file_type?.toLowerCase().includes(lower) ?? false)
      );
    });
  }, [allBrandFiles, allFilesSearchTerm]);

  // Detect stuck files (processing/pending for more than 5 minutes, or failed)
  const stuckFiles = useMemo(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return filteredAllBrandFiles.filter(file => {
      // Include failed files
      if (file.processing_status === 'failed') return true;

      // Include processing/pending files stuck > 5 minutes
      if (
        (file.processing_status === 'processing' || file.processing_status === 'pending') &&
        file.updated_at &&
        new Date(file.updated_at) < fiveMinutesAgo
      ) {
        return true;
      }

      return false;
    });
  }, [filteredAllBrandFiles]);

  // Statistics for "All Files" view
  const allFilesStats = useMemo(() => {
    const total = filteredAllBrandFiles.length;
    const pending = filteredAllBrandFiles.filter(f => f.processing_status === 'pending').length;
    const processing = filteredAllBrandFiles.filter(f => f.processing_status === 'processing').length;
    const completed = filteredAllBrandFiles.filter(f => f.processing_status === 'completed').length;
    const failed = filteredAllBrandFiles.filter(f => f.processing_status === 'failed').length;

    const brandCounts: Record<string, number> = {};
    filteredAllBrandFiles.forEach(file => {
      if (file.brands?.name) {
        brandCounts[file.brands.name] = (brandCounts[file.brands.name] || 0) + 1;
      }
    });

    return { total, pending, processing, completed, failed, brandCounts };
  }, [filteredAllBrandFiles]);
  const createCategoryMutation = useMutation({
    mutationFn: async ({
      name,
      description,
      chromaCollection
    }: {
      name: string;
      description?: string;
      chromaCollection: string;
    }) => {
      const {
        data,
        error
      } = await supabase.from("knowledge_base_categories").insert({
        name,
        description,
        collection_key: chromaCollection
      }).select("id").single();
      if (error) throw error;
      if (data?.id) {
        setSelectedCategoryId(data.id);
      }
    },
    onSuccess: () => {
      toast({
        title: "Category created",
        description: "New knowledge category ready for sources."
      });
      setCategoryModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["knowledge-categories"]
      });
    },
    onError: error => {
      toast({
        title: "Failed to create category",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });
  const createSourceMutation = useMutation({
    mutationFn: async ({
      name,
      type,
      config
    }: {
      name: string;
      type: KnowledgeSourceType;
      config: Record<string, unknown>;
    }) => {
      if (!selectedCategoryId) throw new Error("Select a category first");
      const {
        error
      } = await supabase.from("knowledge_sources").insert([{
        category_id: selectedCategoryId,
        name,
        type,
        config: config as any
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Source connected",
        description: "We\'ll keep this source in sync going forward."
      });
      setSourceModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["knowledge-sources", selectedCategoryId]
      });
    },
    onError: error => {
      toast({
        title: "Failed to add source",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from("knowledge_base_categories")
        .update({ is_active: false })
        .eq("id", categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Category deleted",
        description: "Knowledge category has been removed."
      });
      setSelectedCategoryId(null);
      queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
    },
    onError: error => {
      toast({
        title: "Failed to delete category",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("knowledge_sources")
        .update({ is_active: false })
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Source removed",
        description: "Knowledge source has been disconnected."
      });
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources", selectedCategoryId] });
    },
    onError: error => {
      toast({
        title: "Failed to remove source",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      sourceId,
      file
    }: {
      sourceId: string;
      file: File;
    }) => {
      // Validate file before upload
      const ALLOWED_EXTENSIONS = ['.txt', '.md'];
      const ALLOWED_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

      const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
      if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        throw new Error(`Invalid file type. Only .txt and .md files are supported. Your file: ${fileExtension || 'unknown'}`);
      }

      if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(`Invalid file format. File must be plain text or markdown. Detected type: ${file.type}`);
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum file size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // Use edge function for proper upload and indexing
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceId', sourceId);

      const { data, error } = await supabase.functions.invoke('knowledge-base-upload', {
        body: formData,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || data?.message || 'Upload failed');
      }

      return data;
    }
  });
  const syncMutation = useMutation({
    mutationFn: async () => {
      try {
        const {
          error,
          data
        } = await supabase.functions.invoke("knowledge-base", {
          body: {
            action: "sync-to-chroma"
          }
        });
        if (error) throw error;
        return data as {
          timestamp?: string;
        } | null;
      } catch (error) {
        // Provide more helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('Failed to send a request')) {
            throw new Error('Edge function unavailable. Please ensure the knowledge-base function is deployed and Supabase is properly configured.');
          }
          if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection and try again.');
          }
        }
        throw error;
      }
    },
    onSuccess: data => {
      toast({
        title: "Knowledge sync complete",
        description: data?.timestamp ? `Updated at ${formatDateTime(data.timestamp)}` : "Knowledge collections refreshed."
      });
      queryClient.invalidateQueries({
        queryKey: ["knowledge-files", selectedCategoryId]
      });
      queryClient.invalidateQueries({
        queryKey: ["knowledge-categories"]
      });
      queryClient.invalidateQueries({
        queryKey: ["knowledge-sources", selectedCategoryId]
      });
    },
    onError: error => {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unable to sync knowledge. Please check console for details.",
        variant: "destructive"
      });
    }
  });
  const syncSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      try {
        const {
          error,
          data
        } = await supabase.functions.invoke("knowledge-base", {
          body: {
            action: "sync-google-drive",
            sourceId
          }
        });
        if (error) throw error;
        return data as {
          synced: number;
          lastSynced: string;
        } | null;
      } catch (error) {
        // Provide more helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('Failed to send a request')) {
            throw new Error('Edge function unavailable. Please ensure the knowledge-base function is deployed.');
          }
          if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
            throw new Error('Network error. Please check your internet connection and try again.');
          }
        }
        throw error;
      }
    },
    onSuccess: data => {
      toast({
        title: "Google Drive synced",
        description: data?.lastSynced ? `Fetched ${data.synced ?? 0} files at ${formatDateTime(data.lastSynced)}` : "Drive folder refreshed."
      });
      queryClient.invalidateQueries({
        queryKey: ["knowledge-files", selectedCategoryId]
      });
      queryClient.invalidateQueries({
        queryKey: ["knowledge-sources", selectedCategoryId]
      });
    },
    onError: error => {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unable to sync source",
        variant: "destructive"
      });
    }
  });

  // Retry failed file mutation
  const retryFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      // Reset the file status to 'pending' so it gets picked up by the worker
      const { error } = await supabase
        .from('knowledge_files')
        .update({
          processing_status: 'pending',
          last_error: null,
          error_timestamp: null,
          // Don't reset retry_count - we want to track total attempts
        })
        .eq('id', fileId);

      if (error) throw error;
      return { success: true, fileId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-brand-knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-files"] });
      toast({
        title: "Retry queued",
        description: "The file has been queued for reprocessing.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Retry failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper function to handle retry
  const handleRetryFile = (fileId: string) => {
    retryFileMutation.mutate(fileId);
  };

  // Delete stuck knowledge files mutation
  const deleteStuckFiles = useMutation({
    mutationFn: async (fileIds: string[]) => {
      if (!fileIds || fileIds.length === 0) throw new Error('File IDs are required');

      // Separate files into global (no brand_id) and brand-specific
      const globalFileIds: string[] = [];
      const filesByBrand = new Map<string, string[]>();

      for (const fileId of fileIds) {
        const file = filteredAllBrandFiles.find(f => f.id === fileId);
        if (!file) {
          console.warn(`File ${fileId} not found, skipping`);
          continue;
        }

        if (!file.brand_id) {
          // Global knowledge base file
          globalFileIds.push(fileId);
        } else {
          // Brand-specific file
          if (!filesByBrand.has(file.brand_id)) {
            filesByBrand.set(file.brand_id, []);
          }
          filesByBrand.get(file.brand_id)!.push(fileId);
        }
      }

      let totalDeleted = 0;
      let totalFailed = 0;
      const allErrors: string[] = [];

      // Delete global files directly (admin only)
      if (globalFileIds.length > 0) {
        try {
          for (const fileId of globalFileIds) {
            const file = filteredAllBrandFiles.find(f => f.id === fileId);
            if (!file) continue;

            // Delete embeddings from knowledge_embeddings table
            const { error: embeddingsError } = await supabase
              .from('knowledge_embeddings')
              .delete()
              .eq('file_id', fileId);

            if (embeddingsError) {
              console.warn(`Embeddings deletion warning for ${fileId}:`, embeddingsError);
            }

            // Delete from storage if path exists
            if (file.path) {
              const { error: storageError } = await supabase.storage
                .from('knowledge')
                .remove([file.path]);

              if (storageError) {
                console.warn(`Storage deletion warning for ${fileId}:`, storageError);
              }
            }

            // Delete file record
            const { error: dbError } = await supabase
              .from('knowledge_files')
              .delete()
              .eq('id', fileId);

            if (dbError) {
              console.error(`Failed to delete global file ${fileId}:`, dbError);
              totalFailed++;
              allErrors.push(`${file.name}: ${dbError.message}`);
            } else {
              totalDeleted++;
            }
          }
        } catch (err) {
          console.error('Exception deleting global files:', err);
          totalFailed += globalFileIds.length;
          allErrors.push(`Global files: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Delete brand-specific files using edge function
      for (const [brandId, brandFileIds] of filesByBrand.entries()) {
        try {
          const { data, error } = await supabase.functions.invoke('delete-stuck-knowledge-files', {
            body: {
              file_ids: brandFileIds,
              brand_id: brandId
            }
          });

          if (error) {
            console.error(`Error deleting files for brand ${brandId}:`, error);
            totalFailed += brandFileIds.length;
            allErrors.push(`Brand ${brandId}: ${error.message}`);
            continue;
          }

          totalDeleted += data.deleted || 0;
          totalFailed += data.failed || 0;
          if (data.errors?.length > 0) {
            allErrors.push(...data.errors);
          }
        } catch (err) {
          console.error(`Exception deleting files for brand ${brandId}:`, err);
          totalFailed += brandFileIds.length;
          allErrors.push(`Brand ${brandId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      return {
        deleted: totalDeleted,
        failed: totalFailed,
        errors: allErrors
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-brand-knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-files"] });

      if (data.deleted > 0) {
        toast({
          title: "Files deleted",
          description: `Successfully deleted ${data.deleted} file(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
        });
      }

      if (data.failed > 0 && data.deleted === 0) {
        toast({
          title: "Delete failed",
          description: `Failed to delete ${data.failed} file(s). ${data.errors[0] || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleManualUpload = async () => {
    if (!manualSourceId || filesToUpload.length === 0) return;
    try {
      for (const file of filesToUpload) {
        await uploadMutation.mutateAsync({
          sourceId: manualSourceId,
          file
        });
      }
      toast({
        title: "Files uploaded",
        description: `${filesToUpload.length} file(s) queued for indexing.`
      });
      setFilesToUpload([]);
      setFileInputKey(value => value + 1);
      queryClient.invalidateQueries({
        queryKey: ["knowledge-files", selectedCategoryId]
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload file",
        variant: "destructive"
      });
    }
  };
  const isUploading = uploadMutation.isPending;
  const isSyncing = syncMutation.isPending;
  
  return <div className="flex h-full min-h-[calc(100vh-120px)] bg-background">
      {/* Main Tabs */}
      <div className="w-full">
        <div className="border-b">
          <div className="mx-auto max-w-7xl px-6">
            <Tabs value={mainTab} onValueChange={setMainTab}>
              <TabsList className="h-12">
                <TabsTrigger value="all-brand-files" className="px-6">
                  <Database className="mr-2 h-4 w-4" />
                  All Brand Files
                </TabsTrigger>
                <TabsTrigger value="knowledge-base" className="px-6">
                  <Database className="mr-2 h-4 w-4" />
                  Knowledge Base
                </TabsTrigger>
                <TabsTrigger value="google-drive" className="px-6">
                  <FolderSync className="mr-2 h-4 w-4" />
                  Google Drive Integration
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsContent value="all-brand-files" className="mt-0">
            <div className="mx-auto max-w-7xl p-6 space-y-6">
              <div>
                <h1 className="text-3xl font-bold">All Brand Files</h1>
                <p className="text-muted-foreground">
                  View and manage all files uploaded across all brands and categories
                </p>
              </div>

              {/* Statistics Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Files</CardDescription>
                    <CardTitle className="text-3xl">{allFilesStats.total}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Completed</CardDescription>
                    <CardTitle className="text-3xl text-green-600">{allFilesStats.completed}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Processing</CardDescription>
                    <CardTitle className="text-3xl text-blue-600">{allFilesStats.processing}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Pending</CardDescription>
                    <CardTitle className="text-3xl text-gray-600">{allFilesStats.pending}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Failed</CardDescription>
                    <CardTitle className="text-3xl text-red-600">{allFilesStats.failed}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Filters and Search */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Filters</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex-1">
                    <Label>Brand Filter</Label>
                    <Select value={allFilesBrandFilter} onValueChange={setAllFilesBrandFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Brands ({allBrandFiles.length} files)</SelectItem>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name} ({allBrandFiles.filter(f => f.brand_id === brand.id).length} files)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Search Files</Label>
                    <Input
                      placeholder="Search by name, brand, or source..."
                      value={allFilesSearchTerm}
                      onChange={(e) => setAllFilesSearchTerm(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Stuck Files Alert */}
              {stuckFiles.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Stuck Files Detected</AlertTitle>
                  <AlertDescription className="flex items-center justify-between">
                    <span>{stuckFiles.length} file(s) need cleanup (stuck processing/pending or failed)</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete ${stuckFiles.length} stuck file(s)? This action cannot be undone.`)) {
                          const fileIds = stuckFiles.map(f => f.id);
                          await deleteStuckFiles.mutateAsync(fileIds);
                        }
                      }}
                      className="ml-4"
                      disabled={deleteStuckFiles.isPending}
                    >
                      {deleteStuckFiles.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clean Up {stuckFiles.length} Stuck Files
                        </>
                      )}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Files Table */}
              <Card>
                <CardHeader>
                  <CardTitle>All Files ({filteredAllBrandFiles.length})</CardTitle>
                  <CardDescription>
                    Complete list of all files uploaded to the vector database across all brands
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAllBrandFiles ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredAllBrandFiles.length === 0 ? (
                    <div className="rounded-md border border-dashed px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        {allFilesSearchTerm ? "No files match your search criteria" : "No brand files uploaded yet"}
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>File Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead>Embeddings</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAllBrandFiles.map((file) => (
                            <TableRow key={file.id}>
                              <TableCell className="font-medium max-w-xs truncate">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{file.name}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{file.name}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {file.brands?.name || 'Unknown'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {file.knowledge_sources?.name || 'Unknown Source'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {fileTypeLabel(file.file_type)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <StatusBadge file={file as any} onRetry={handleRetryFile} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDateTime(file.created_at)}
                              </TableCell>
                              <TableCell className="text-center">
                                {file.embedding_count ? (
                                  <Badge variant="outline" className="bg-blue-50">
                                    {file.embedding_count}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setFileToDelete({ id: file.id, file_name: file.name });
                                          setShowDeleteDialog(true);
                                        }}
                                        disabled={file.processing_status === 'completed' && file.is_indexed}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        {file.processing_status === 'completed' && file.is_indexed
                                          ? "Cannot delete indexed files"
                                          : "Delete this file"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="google-drive" className="mt-0">
            <div className="mx-auto max-w-7xl p-6">
              <GoogleDriveIntegrationTab />
            </div>
          </TabsContent>

          <TabsContent value="knowledge-base" className="mt-0">
            <div className="flex h-full min-h-[calc(100vh-200px)]">
      <aside className="hidden w-72 border-r bg-muted/40 lg:flex lg:flex-col">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h2 className="text-lg font-semibold">Categories</h2>
            <p className="text-xs text-muted-foreground">Organize knowledge by business area</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setCategoryModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add Category</span>
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 pb-6">
          <div className="space-y-2">
            {isLoadingCategories && <p className="px-2 text-sm text-muted-foreground">Loading categories...</p>}
            {!isLoadingCategories && categories.length === 0 && <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                Create your first knowledge category to get started.
              </div>}
            {categories.map(category => <div key={category.id} className="group relative">
                <Button variant={category.id === selectedCategoryId ? "secondary" : "ghost"} className="w-full justify-start pr-10" onClick={() => setSelectedCategoryId(category.id)}>
                  <div className="space-y-1 text-left">
                    <div className="font-medium">{category.name}</div>
                    {category.description && <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>}
                  </div>
                </Button>
                <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete "${category.name}"? This will also deactivate all associated sources.`)) {
                    deleteCategoryMutation.mutate(category.id);
                  }
                }} disabled={deleteCategoryMutation.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete category</span>
                </Button>
              </div>)}
          </div>
        </ScrollArea>
        <div className="border-t px-4 py-4">
          <Button className="w-full" onClick={() => setCategoryModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Knowledge Base</h1>
              <p className="text-muted-foreground">
                Connect Google Drive, Supabase folders, and manual uploads to keep your AI agents informed.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <div className="text-xs uppercase text-muted-foreground">Last Synced</div>
              <div className="text-sm font-medium">
                {selectedCategory ? formatDateTime(selectedCategory.last_synced) : "Select a category"}
              </div>
            </div>
          </div>

          {/* Brand Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Filter by Brand</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Files</SelectItem>
                  <SelectItem value="global">Global Files Only</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold">
                  {selectedCategory ? selectedCategory.name : "Select a category"}
                </CardTitle>
                <CardDescription>
                  {selectedCategory?.description || "Choose a category on the left to manage its knowledge sources."}
                </CardDescription>
                {categories.length > 0 && <div className="mt-4 space-y-2 lg:hidden">
                    <Label className="text-xs uppercase text-muted-foreground">Active Category</Label>
                    <Select value={selectedCategoryId ?? undefined} onValueChange={value => setSelectedCategoryId(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setSourceModalOpen(true)} disabled={!selectedCategoryId}>
                  <FolderSync className="mr-2 h-4 w-4" /> Add Source
                </Button>
                <Button onClick={() => syncMutation.mutate()} disabled={!selectedCategoryId || isSyncing}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> {isSyncing ? "Syncing" : "Sync Knowledge"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList>
                    <TabsTrigger value="sources">Sources</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="sync">Sync</TabsTrigger>
                  </TabsList>
                  {activeTab === "sources"}
                </div>

                <TabsContent value="sources" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FolderSync className="h-5 w-5 text-muted-foreground" /> Connected Sources
                      </CardTitle>
                      <CardDescription>
                        Each source keeps this category up to date. Google Drive folders can be synced on demand.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingSources ? <p className="text-sm text-muted-foreground">Loading sources...</p> : sources.length === 0 ? <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                          No sources connected yet. Add a Google Drive folder, Supabase path, or upload manually.
                        </div> : <div className="space-y-4">
                          {sources.map(source => <Card key={source.id}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="space-y-1">
                                  <CardTitle className="text-base">{source.name}</CardTitle>
                                  <CardDescription className="flex items-center gap-2">
                                    <Badge variant="outline">{humanizeSourceType(source.type)}</Badge>
                                    <span className="text-xs">Last synced: {formatDateTime(source.last_synced)}</span>
                                  </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                  {source.type === "google_drive" && <Button size="sm" variant="outline" onClick={() => syncSourceMutation.mutate(source.id)} disabled={syncSourceMutation.isPending}>
                                      <RefreshCcw className="mr-2 h-4 w-4" /> Sync Drive
                                    </Button>}
                                  <Button size="sm" variant="outline" onClick={() => {
                                    if (confirm(`Are you sure you want to remove "${source.name}"? The files will remain but won't be synced.`)) {
                                      deleteSourceMutation.mutate(source.id);
                                    }
                                  }} disabled={deleteSourceMutation.isPending}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Remove source</span>
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <SourceFilesSection source={source} />
                              </CardContent>
                            </Card>)}
                        </div>}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="files" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <UploadCloud className="h-5 w-5 text-muted-foreground" /> Manual Uploads
                      </CardTitle>
                      <CardDescription>Upload PDFs, docs, or text files to attach them to this category.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {manualSources.length === 0 ? <p className="text-sm text-muted-foreground">
                          Add a manual upload source to enable drag-and-drop uploads directly from the dashboard.
                        </p> : <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                          <div className="w-full sm:w-64">
                            <Label>Select Manual Source</Label>
                            <Select value={manualSourceId || undefined} onValueChange={value => setManualSourceId(value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a manual source" />
                              </SelectTrigger>
                              <SelectContent>
                                {manualSources.map(source => <SelectItem key={source.id} value={source.id}>
                                    {source.name}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Input
                              key={fileInputKey}
                              type="file"
                              multiple
                              accept=".txt,.md"
                              onChange={event => setFilesToUpload(Array.from(event.target.files ?? []))}
                            />
                          </div>
                          <Button onClick={handleManualUpload} disabled={!manualSourceId || filesToUpload.length === 0 || isUploading}>
                            <UploadCloud className="mr-2 h-4 w-4" /> {isUploading ? "Uploading" : "Upload"}
                          </Button>
                        </div>}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-lg">Indexed Files</CardTitle>
                          <CardDescription>Track every document connected to this category.</CardDescription>
                        </div>
                        <Input placeholder="Search files" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="w-full sm:w-64" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingFiles ? <p className="text-sm text-muted-foreground">Loading files...</p> : filteredFiles.length === 0 ? <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                          No files found. Upload a document or sync a source to see it here.
                        </div> : <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Brand</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Last Indexed</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFiles.map(file => <TableRow key={file.id}>
                                <TableCell className="font-medium">{file.name}</TableCell>
                                <TableCell>{file.knowledge_sources.name}</TableCell>
                                <TableCell>
                                  {file.brand_id ? (
                                    <Badge variant="outline">
                                      {brands.find(b => b.id === file.brand_id)?.name || 'Brand'}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Global</span>
                                  )}
                                </TableCell>
                                <TableCell>{fileTypeLabel(file.file_type)}</TableCell>
                                <TableCell>
                                  <StatusBadge file={file} onRetry={handleRetryFile} />
                                </TableCell>
                                <TableCell>{formatDateTime(file.last_indexed)}</TableCell>
                              </TableRow>)}
                          </TableBody>
                        </Table>}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="sync" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Database className="h-5 w-5 text-muted-foreground" /> Knowledge Sync Overview
                      </CardTitle>
                      <CardDescription>
                        Run a full re-sync or refresh individual sources. Collections are indexed for agent access.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-md border bg-muted/40 p-4">
                          <div className="text-xs uppercase text-muted-foreground">Collection ID</div>
                          <div className="font-mono text-sm font-medium">
                            {selectedCategory?.collection_key ?? "company_unknown"}
                          </div>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-4">
                          <div className="text-xs uppercase text-muted-foreground">Last Indexed</div>
                          <div className="text-sm font-medium">
                            {selectedCategory ? formatDateTime(selectedCategory.last_synced) : "Select a category"}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                        Agents like the LinkedIn agent automatically connect to knowledge collections named after the category.
                        Use sync when new files are added or after refreshing Google Drive folders.
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-semibold">Source sync actions</div>
                        <div className="space-y-2">
                          {sources.length === 0 && <p className="text-sm text-muted-foreground">No sources connected yet.</p>}
                          {sources.map(source => <div key={source.id} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{source.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {humanizeSourceType(source.type)} • Last synced {formatDateTime(source.last_synced)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {source.type === "google_drive" ? <Button size="sm" variant="outline" onClick={() => syncSourceMutation.mutate(source.id)} disabled={syncSourceMutation.isPending}>
                                    <RefreshCcw className="mr-2 h-4 w-4" /> Sync Google Drive
                                  </Button> : <Badge variant="outline">Manual sync not required</Badge>}
                                <Button size="sm" variant="outline" onClick={() => {
                                  if (confirm(`Are you sure you want to remove "${source.name}"?`)) {
                                    deleteSourceMutation.mutate(source.id);
                                  }
                                }} disabled={deleteSourceMutation.isPending}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                  <span className="sr-only">Remove source</span>
                                </Button>
                              </div>
                            </div>)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AddCategoryModal open={categoryModalOpen} onOpenChange={setCategoryModalOpen} onCreate={({
      name,
      description,
      chromaCollection
    }) => createCategoryMutation.mutateAsync({
      name,
      description,
      chromaCollection
    })} isSubmitting={createCategoryMutation.isPending} />
      <AddSourceModal open={sourceModalOpen} onOpenChange={setSourceModalOpen} onSave={({
      name,
      type,
      config
    }) => createSourceMutation.mutateAsync({
      name,
      type,
      config
    })} isSubmitting={createSourceMutation.isPending} />

      {/* Delete File Dialog */}
      <DeleteFileDialog
        file={fileToDelete}
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setFileToDelete(null);
        }}
        onConfirm={async (fileId) => {
          await deleteStuckFiles.mutateAsync([fileId]);
        }}
      />
    </div>;
};
export default KnowledgeBase;