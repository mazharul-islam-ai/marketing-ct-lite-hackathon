import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FolderSync, Loader2, Trash2, FileText, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface KnowledgeSource {
  id: string;
  name: string;
  source_type: string;
  config: any;
  is_active: boolean;
  last_synced_at: string | null;
}

interface KnowledgeFile {
  id: string;
  file_name: string;
  file_size: number | null;
  sync_status: string;
  created_at: string;
}

interface ProjectKnowledgeSourceProps {
  source: KnowledgeSource;
  projectId: string;
  onSync: () => void;
  onDelete: () => void;
}

export const ProjectKnowledgeSource = ({ source, projectId, onSync, onDelete }: ProjectKnowledgeSourceProps) => {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [fileCount, setFileCount] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Load file count on mount and when source changes
  useEffect(() => {
    loadFileCount();
    if (source.source_type === "google_drive") {
      checkGoogleDriveConnection();
    } else {
      setIsConnected(true); // Manual sources are always "connected"
    }
  }, [source.id]);

  const loadFileCount = async () => {
    try {
      const { count, error } = await (supabase as any)
        .from("project_knowledge_files")
        .select("*", { count: "exact", head: true })
        .eq("source_id", source.id);

      if (error) throw error;
      setFileCount(count || 0);
    } catch (error: any) {
      console.error("Error loading file count:", error);
    }
  };

  const checkGoogleDriveConnection = async () => {
    setIsCheckingConnection(true);
    try {
      // For Google Drive sources, check if folder ID is configured
      const hasFolderId = !!source.config?.folderId;
      setIsConnected(hasFolderId);
    } catch (error) {
      console.error("Error checking Google Drive connection:", error);
      setIsConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const loadFiles = async () => {
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("project_knowledge_files")
        .select("*")
        .eq("source_id", source.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setFiles(data || []);
      setShowFiles(true);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to load files";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error loading files:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 50MB");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const bucket = source.config.bucket || "knowledge";
      const folder = source.config.folder || "projects";
      const timestamp = Date.now();
      const filePath = `${folder}/${projectId}/${timestamp}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) {
        if (uploadError.message.includes("already exists")) {
          throw new Error("A file with this name already exists. Please rename and try again.");
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from("project_knowledge_files")
        .insert({
          project_id: projectId,
          source_id: source.id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          file_type: "upload",
          sync_status: "pending",
        });

      if (dbError) throw dbError;

      toast.success(`"${file.name}" uploaded successfully`);
      loadFileCount();
      loadFiles();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to upload file";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("project-knowledge-sync", {
        body: { sourceId: source.id, projectId },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Sync completed successfully");
      onSync();
      loadFileCount();
      loadFiles();
    } catch (error: any) {
      const errorMessage = error.message || "Failed to sync files";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error syncing:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {source.source_type === "google_drive" ? <FolderSync className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              {source.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {source.source_type === "google_drive" ? "Google Drive Folder" : "Manual Upload"}
            </CardDescription>
            {source.source_type === "google_drive" && (
              <div className="flex items-center gap-2 mt-2">
                {isCheckingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isConnected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-destructive font-medium">Not Connected</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={source.is_active ? "default" : "secondary"}>
              {source.is_active ? "Active" : "Inactive"}
            </Badge>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {source.last_synced_at && (
          <p className="text-xs text-muted-foreground mt-2">
            Last synced: {format(new Date(source.last_synced_at), "MMM d, yyyy h:mm a")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          {source.source_type === "manual" && (
            <Button size="sm" variant="outline" disabled={isUploading} asChild>
              <label className="cursor-pointer">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Choose File
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
                />
              </label>
            </Button>
          )}
          {source.source_type === "google_drive" && (
            <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderSync className="mr-2 h-4 w-4" />}
              Sync Now
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={loadFiles}>
            <FileText className="mr-2 h-4 w-4" />
            View Files ({fileCount})
          </Button>
        </div>

        {showFiles && files.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium">Files</h4>
            <div className="space-y-1">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{file.file_name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                    <Badge variant={file.sync_status === "indexed" ? "default" : "secondary"} className="text-xs">
                      {file.sync_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
