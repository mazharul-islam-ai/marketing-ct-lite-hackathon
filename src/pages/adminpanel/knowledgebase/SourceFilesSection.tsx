import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Loader2, CheckCircle, Clock, Plug, PlugZap, FolderSync } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GoogleDriveConnectDialog } from "./GoogleDriveConnectDialog";

interface KnowledgeFile {
  id: string;
  name: string;
  path: string;
  file_type: string | null;
  is_indexed: boolean;
  last_indexed: string | null;
  created_at: string;
}

interface KnowledgeSource {
  id: string;
  name: string;
  type: 'manual' | 'google_drive' | 'supabase' | 'api';
}

interface SourceFilesSectionProps {
  source: KnowledgeSource;
}

export const SourceFilesSection = ({ source }: SourceFilesSectionProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileCount, setFileCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Load file count and check connection on mount
  useEffect(() => {
    loadFileCount();
    checkConnection();
  }, [source.id]);

  const loadFileCount = async () => {
    try {
      const { count, error } = await supabase
        .from('knowledge_files')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', source.id);

      if (error) throw error;
      setFileCount(count || 0);
    } catch (error: any) {
      console.error("Error loading file count:", error);
    }
  };

  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      if (source.type === 'google_drive') {
        const config = source as any;
        const folderId = config.config?.folderId;
        setIsConnected(!!folderId && folderId.length > 0);
      } else {
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Error checking connection:", error);
      setIsConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['knowledge-files', source.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_files')
        .select('*')
        .eq('source_id', source.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KnowledgeFile[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase
        .from('knowledge_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-files', source.id] });
      loadFileCount();
      toast.success('File deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation constants
    const ALLOWED_EXTENSIONS = ['.txt', '.md'];
    const ALLOWED_MIME_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    // Validate file extension
    const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      toast.error(`Invalid file type. Only .txt and .md files are supported. Your file: ${fileExtension || 'unknown'}`);
      e.target.value = ''; // Clear input
      return;
    }

    // Validate MIME type
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error(`Invalid file format. File must be plain text or markdown. Detected type: ${file.type}`);
      e.target.value = '';
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum file size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      e.target.value = '';
      return;
    }

    // All validations passed
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceId', source.id);

      const { data, error } = await supabase.functions.invoke('knowledge-base-upload', {
        body: formData,
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('File uploaded successfully');
        setSelectedFile(null);
        queryClient.invalidateQueries({ queryKey: ['knowledge-files', source.id] });
        loadFileCount();
      } else {
        throw new Error(data?.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConnectFolder = async (folderId: string) => {
    try {
      const currentConfig = (source as any).config || {};
      const { error } = await supabase
        .from('knowledge_sources')
        .update({ 
          config: { ...currentConfig, folderId } 
        })
        .eq('id', source.id);

      if (error) throw error;

      toast.success('Google Drive folder connected');
      setShowConnectDialog(false);
      checkConnection();
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('knowledge-base', {
        body: {
          action: 'sync-google-drive',
          sourceId: source.id,
        },
      });

      if (error) throw error;

      toast.success('Google Drive synced successfully');
      loadFileCount();
      queryClient.invalidateQueries({ queryKey: ['knowledge-files', source.id] });
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  if (source.type !== 'manual') {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Files</CardTitle>
                <CardDescription>
                  {source.type === 'google_drive' && 'Files are synced from Google Drive'}
                  {source.type === 'supabase' && 'Files are synced from Supabase Storage'}
                  {source.type === 'api' && 'Files are managed via API'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {source.type === 'google_drive' && (
                  <div className="flex items-center gap-2">
                    {isCheckingConnection ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : isConnected ? (
                      <>
                        <PlugZap className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600 font-medium">Connected</span>
                      </>
                    ) : (
                      <>
                        <Plug className="h-4 w-4 text-amber-600" />
                        <span className="text-xs text-amber-600 font-medium">Not Connected</span>
                      </>
                    )}
                  </div>
                )}
                <Badge variant="secondary" className="font-mono">
                  {fileCount} {fileCount === 1 ? 'file' : 'files'}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {source.type === 'google_drive' && (
              <div className="flex gap-2 mb-4">
                {!isConnected ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowConnectDialog(true)}
                  >
                    <Plug className="h-4 w-4 mr-2" />
                    Connect Folder
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FolderSync className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                )}
              </div>
            )}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files synced yet</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {file.is_indexed ? (
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
        {source.type === 'google_drive' && (
          <GoogleDriveConnectDialog
            open={showConnectDialog}
            onOpenChange={setShowConnectDialog}
            onConnect={handleConnectFolder}
            sourceId={source.id}
          />
        )}
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Files</CardTitle>
            <CardDescription>Upload documents for AI agent knowledge</CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono">
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="file"
              id={`file-upload-${source.id}`}
              className="hidden"
              onChange={handleFileSelect}
              accept=".txt,.md"
            />
            <label htmlFor={`file-upload-${source.id}`}>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedFile ? selectedFile.name : 'Choose File'}
                </span>
              </Button>
            </label>
          </div>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No files uploaded yet
          </p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                    {file.is_indexed && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Indexed
                      </Badge>
                    )}
                    {!file.is_indexed && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(file.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};