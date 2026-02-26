import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Check,
  X,
  Eye,
  RefreshCw,
  Shield,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface SafetyBlock {
  id: string;
  image_id: string | null;
  user_id: string;
  prompt: string;
  blocked_categories: any[];
  safety_scores: any;
  admin_status: "pending" | "approved" | "rejected";
  override_by: string | null;
  override_at: string | null;
  admin_notes: string | null;
  user_appeal_reason: string | null;
  appealed_at: string | null;
  created_at: string;
  // Joined fields
  user_email?: string;
  user_name?: string;
}

export function SafetyAppealQueue() {
  const [blocks, setBlocks] = useState<SafetyBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<SafetyBlock | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const { toast } = useToast();

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = (supabase as any)
        .from("image_safety_blocks")
        .select(`
          *,
          users:user_id (
            email,
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("admin_status", filter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Transform data to include user info
      const transformedData = (data || []).map((block: any) => ({
        ...block,
        user_email: block.users?.email,
        user_name: block.users?.first_name && block.users?.last_name
          ? `${block.users.first_name} ${block.users.last_name}`.trim()
          : block.users?.first_name || block.users?.last_name || null,
      }));

      setBlocks(transformedData);
    } catch (error) {
      console.error("Error fetching safety blocks:", error);
      toast({
        title: "Error",
        description: "Failed to load safety blocks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleReview = (block: SafetyBlock) => {
    setSelectedBlock(block);
    setAdminNotes(block.admin_notes || "");
    setReviewDialogOpen(true);
  };

  const handleApproval = async (approved: boolean) => {
    if (!selectedBlock) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from("image_safety_blocks")
        .update({
          admin_status: approved ? "approved" : "rejected",
          override_by: user?.id,
          override_at: new Date().toISOString(),
          admin_notes: adminNotes,
        })
        .eq("id", selectedBlock.id);

      if (error) throw error;

      toast({
        title: approved ? "Appeal Approved" : "Appeal Rejected",
        description: approved
          ? "The user can now regenerate this prompt."
          : "The block has been confirmed.",
      });

      setReviewDialogOpen(false);
      setSelectedBlock(null);
      setAdminNotes("");
      fetchBlocks();
    } catch (error) {
      console.error("Error updating appeal:", error);
      toast({
        title: "Error",
        description: "Failed to update appeal status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryDisplay = (categories: any[]) => {
    if (!categories || categories.length === 0) return "Unknown";
    return categories
      .map((cat) => {
        const name = typeof cat === "string"
          ? cat
          : cat.category?.replace("HARM_CATEGORY_", "") || "Unknown";
        return name;
      })
      .join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Safety Appeal Queue
            </CardTitle>
            <CardDescription>
              Review and manage content safety block appeals
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filter === "approved" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("approved")}
            >
              Approved
            </Button>
            <Button
              variant={filter === "rejected" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("rejected")}
            >
              Rejected
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button variant="outline" size="sm" onClick={fetchBlocks}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No {filter === "all" ? "" : filter} appeals found</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Appeal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{block.user_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{block.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm truncate" title={block.prompt}>
                        {block.prompt}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getCategoryDisplay(block.blocked_categories)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {block.user_appeal_reason ? (
                        <div className="flex items-center gap-1 text-blue-600">
                          <MessageSquare className="w-3 h-3" />
                          <span className="text-xs">Has appeal</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No appeal</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(block.admin_status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(block.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleReview(block)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Review Safety Block
            </DialogTitle>
            <DialogDescription>
              Review the blocked prompt and user appeal to make a decision.
            </DialogDescription>
          </DialogHeader>

          {selectedBlock && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-semibold mb-1">User</p>
                <p className="text-sm">
                  {selectedBlock.user_name || "Unknown"} ({selectedBlock.user_email})
                </p>
              </div>

              {/* Blocked Prompt */}
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Blocked Prompt
                </p>
                <p className="text-sm">{selectedBlock.prompt}</p>
              </div>

              {/* Blocked Categories */}
              <div>
                <p className="text-sm font-semibold mb-2">Triggered Categories</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBlock.blocked_categories?.map((cat: any, idx: number) => (
                    <Badge key={idx} variant="destructive">
                      {typeof cat === "string"
                        ? cat.replace("HARM_CATEGORY_", "")
                        : cat.category?.replace("HARM_CATEGORY_", "") || "Unknown"}
                      {cat.probability && ` (${cat.probability})`}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* User Appeal */}
              {selectedBlock.user_appeal_reason && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    User's Appeal
                  </p>
                  <p className="text-sm">{selectedBlock.user_appeal_reason}</p>
                  {selectedBlock.appealed_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted {formatDistanceToNow(new Date(selectedBlock.appealed_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes</Label>
                <Textarea
                  id="adminNotes"
                  placeholder="Add notes about your decision (optional)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              {/* Previous Decision */}
              {selectedBlock.admin_status !== "pending" && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-semibold mb-1">Previous Decision</p>
                  <p className="text-sm">
                    {selectedBlock.admin_status === "approved" ? "Approved" : "Rejected"}
                    {selectedBlock.override_at && ` on ${new Date(selectedBlock.override_at).toLocaleDateString()}`}
                  </p>
                  {selectedBlock.admin_notes && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Note: {selectedBlock.admin_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleApproval(false)}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Reject Appeal
            </Button>
            <Button
              variant="default"
              onClick={() => handleApproval(true)}
              disabled={isSubmitting}
            >
              <Check className="w-4 h-4 mr-2" />
              Approve Appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
