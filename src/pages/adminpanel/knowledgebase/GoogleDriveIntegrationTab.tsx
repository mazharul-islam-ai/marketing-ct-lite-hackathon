import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Plus, RefreshCcw, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useGoogleDriveAuth } from "@/hooks/useGoogleDriveAuth";
import { GoogleDriveFolderBrowser } from "@/pages/adminpanel/knowledgebase/GoogleDriveFolderBrowser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GoogleDriveFolder {
  id: string;
  name: string;
  folder_id: string;
  category: string | null;
  last_synced: string | null;
  file_count: number;
  is_active: boolean;
  created_at: string;
}

export const GoogleDriveIntegrationTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedFolderName, setSelectedFolderName] = useState("");
  const [folderInput, setFolderInput] = useState("");
  const [folderDisplayName, setFolderDisplayName] = useState("");
  const [folderCategory, setFolderCategory] = useState("");
  
  const { isAuthenticating, initiateAuth, checkAuthStatus } = useGoogleDriveAuth();

  // Check authentication status
  const { data: authStatus, refetch: refetchAuthStatus } = useQuery({
    queryKey: ["google-drive-auth-status"],
    queryFn: checkAuthStatus,
  });

  // Fetch connected folders
  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["admin-google-drive-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_google_drive_folders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GoogleDriveFolder[];
    },
  });

  // Add folder mutation
  const addFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; folder_id: string; category: string | null }) => {
      const { error } = await supabase
        .from("admin_google_drive_folders")
        .insert([folderData]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Folder connected",
        description: "Google Drive folder has been added successfully",
      });
      setIsAddDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["admin-google-drive-folders"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to add folder",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Sync folder mutation
  const syncFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-google-drive-sync", {
        body: {
          folderId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Sync complete",
        description: `Synced ${data?.synced || 0} files from Google Drive`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-google-drive-folders"] });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unable to sync folder",
        variant: "destructive",
      });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from("admin_google_drive_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Folder removed",
        description: "Google Drive folder has been disconnected",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-google-drive-folders"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove folder",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleAuthClick = async () => {
    const success = await initiateAuth();
    if (success) {
      refetchAuthStatus();
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Google Drive? This will remove your connection and you'll need to re-authenticate.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_google_tokens")
        .delete()
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      toast({
        title: "Disconnected",
        description: "Google Drive has been disconnected successfully",
      });
      
      queryClient.invalidateQueries({ queryKey: ["google-drive-auth-status"] });
      await refetchAuthStatus();
    } catch (error) {
      toast({
        title: "Failed to disconnect",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const extractFolderId = (input: string): string => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/[-\w]{25,}/);
    if (urlMatch) {
      return urlMatch[0];
    }
    return trimmed;
  };

  const handleFolderInputChange = (value: string) => {
    setFolderInput(value);
    const extractedId = extractFolderId(value);
    setSelectedFolderId(extractedId);
  };

  const handleSelectFolder = (folderId: string, folderName: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setFolderDisplayName(folderName);
  };

  const handleAddFolder = () => {
    if (!selectedFolderId || !folderDisplayName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide folder ID and name",
        variant: "destructive",
      });
      return;
    }

    addFolderMutation.mutate({
      name: folderDisplayName.trim(),
      folder_id: selectedFolderId,
      category: folderCategory.trim() || null,
    });
  };

  const resetForm = () => {
    setSelectedFolderId("");
    setSelectedFolderName("");
    setFolderInput("");
    setFolderDisplayName("");
    setFolderCategory("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Google Drive Integration</h2>
          <p className="text-muted-foreground">
            Connect and sync Google Drive folders for marketing intelligence
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} disabled={!authStatus}>
          <Plus className="mr-2 h-4 w-4" />
          Add Folder
        </Button>
      </div>

      {/* Authentication Status */}
      {!authStatus && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Connect your Google account to sync Drive folders</span>
            <Button 
              size="sm" 
              onClick={handleAuthClick}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? "Connecting..." : "Connect Google Drive"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {authStatus && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Google Drive is connected and ready to sync
              </AlertDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="ml-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Disconnect
            </Button>
          </div>
        </Alert>
      )}

      {/* Connected Folders */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Connected Folders</h3>
        
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Loading folders...</p>
            </CardContent>
          </Card>
        ) : folders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-muted-foreground">No folders connected yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first Google Drive folder to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder) => (
              <Card key={folder.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-base">{folder.name}</CardTitle>
                      {folder.category && (
                        <Badge variant="outline" className="text-xs">
                          {folder.category}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => deleteFolderMutation.mutate(folder.id)}
                      disabled={deleteFolderMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Files</span>
                    <span className="font-medium">{folder.file_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last synced</span>
                    <span className="text-xs">
                      {folder.last_synced
                        ? new Date(folder.last_synced).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => syncFolderMutation.mutate(folder.id)}
                    disabled={syncFolderMutation.isPending}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {syncFolderMutation.isPending ? "Syncing..." : "Sync Now"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Folder Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect Google Drive Folder</DialogTitle>
            <DialogDescription>
              Browse your Google Drive or paste a folder link to connect
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Marketing Assets"
                value={folderDisplayName}
                onChange={(e) => setFolderDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-category">Category (Optional)</Label>
              <Input
                id="folder-category"
                placeholder="e.g., Content, Analytics, Reports"
                value={folderCategory}
                onChange={(e) => setFolderCategory(e.target.value)}
              />
            </div>

            <Tabs defaultValue="browse" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="browse">Browse Folders</TabsTrigger>
                <TabsTrigger value="manual">Paste Link</TabsTrigger>
              </TabsList>

              <TabsContent value="browse" className="space-y-4">
                <GoogleDriveFolderBrowser
                  onSelectFolder={handleSelectFolder}
                  selectedFolderId={selectedFolderId}
                />
                {selectedFolderName && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Selected: <strong>{selectedFolderName}</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="folder-link">Folder URL or ID</Label>
                  <Input
                    id="folder-link"
                    placeholder="https://drive.google.com/drive/folders/... or folder ID"
                    value={folderInput}
                    onChange={(e) => handleFolderInputChange(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Right-click a folder in Google Drive → Share → Copy link
                  </p>
                </div>
                {selectedFolderId && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      Folder ID:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">
                        {selectedFolderId}
                      </code>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddFolder}
              disabled={!selectedFolderId || !folderDisplayName.trim() || addFolderMutation.isPending}
            >
              {addFolderMutation.isPending ? "Connecting..." : "Connect Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
