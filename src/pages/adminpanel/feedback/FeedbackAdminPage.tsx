import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, Inbox, UserCircle2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const FEEDBACK_BUCKET = "feedback-attachments";

const statusLabel: Record<FeedbackStatus, string> = {
  open: "Open",
  in_review: "In Review",
  resolved: "Resolved",
  closed: "Closed",
};

const statusVariant: Record<FeedbackStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  in_review: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-800",
};

const typeVariant: Record<"bug" | "feature", string> = {
  bug: "bg-red-100 text-red-800",
  feature: "bg-purple-100 text-purple-800",
};

type FeedbackStatus = "open" | "in_review" | "resolved" | "closed";

type AdminFeedbackListItem = {
  id: string;
  subject: string;
  status: FeedbackStatus;
  type: "bug" | "feature";
  created_at: string;
  updated_at: string;
  email: string | null;
  created_by: string | null;
  submitted_by: string | null;
};

type AdminFeedbackComment = {
  id: string;
  comment: string;
  created_at: string;
  user_id: string | null;
  author_name: string | null;
};

type AdminFeedbackDetail = {
  id: string;
  subject: string;
  description: string;
  status: FeedbackStatus;
  type: "bug" | "feature";
  email: string | null;
  created_at: string;
  updated_at: string;
  attachment_url: string | null;
  attachment_signed_url: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  submitted_by: string | null;
  reviewed_by_name: string | null;
};

type DetailResponse = {
  record: AdminFeedbackDetail;
  comments: AdminFeedbackComment[];
};

type StatusFilter = "all" | FeedbackStatus;
type TypeFilter = "all" | "bug" | "feature";

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const typeFilters: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "bug", label: "Bugs" },
  { value: "feature", label: "Features" },
];

const formatTimestamp = (iso: string) => format(new Date(iso), "MMM d, yyyy · h:mm a");

const buildDisplayName = (profile?: { first_name: string | null; last_name: string | null; email: string | null }) => {
  if (!profile) return null;
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return fullName.length > 0 ? fullName : profile.email;
};

async function loadUserProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();
  }

  const uniqueIds = Array.from(new Set(userIds));

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .in("id", uniqueIds);

  if (error) {
    console.error("Failed to load user profiles", error);
    return new Map();
  }

  return new Map(data.map((profile) => [profile.id, profile]));
}

async function fetchFeedbackList(typeFilter: TypeFilter, statusFilter: StatusFilter): Promise<AdminFeedbackListItem[]> {
  let query = supabase
    .from("feedback_reports")
    .select("id, subject, status, type, created_at, updated_at, email, created_by")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (typeFilter !== "all") {
    query = query.eq("type", typeFilter);
  }

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load feedback list", error);
    throw new Error("Unable to load feedback list. Please try again.");
  }

  const submitterIds = (data ?? [])
    .map((record) => record.created_by)
    .filter((value): value is string => Boolean(value));

  const userMap = await loadUserProfiles(submitterIds);

  return (data ?? []).map((record) => ({
    ...record,
    status: record.status as FeedbackStatus,
    type: record.type as "bug" | "feature",
    submitted_by: buildDisplayName(userMap.get(record.created_by ?? "")) ?? record.email,
  }));
}

async function fetchFeedbackDetail(feedbackId: string): Promise<DetailResponse> {
  const { data: record, error } = await supabase
    .from("feedback_reports")
    .select(
      "id, subject, description, status, type, email, created_at, updated_at, attachment_url, created_by, reviewed_by"
    )
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load feedback detail", error);
    throw new Error("Unable to load feedback detail");
  }

  if (!record) {
    throw new Error("Feedback not found");
  }

  const { data: comments, error: commentsError } = await supabase
    .from("feedback_comments")
    .select("id, comment, created_at, user_id")
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    console.error("Failed to load comments", commentsError);
    throw new Error("Unable to load comments for this feedback");
  }

  const userIds = new Set<string>();
  if (record.created_by) userIds.add(record.created_by);
  if (record.reviewed_by) userIds.add(record.reviewed_by);
  comments?.forEach((comment) => {
    if (comment.user_id) {
      userIds.add(comment.user_id);
    }
  });

  const userMap = await loadUserProfiles(Array.from(userIds));

  const formatUser = (id: string | null) => {
    if (!id) return null;
    const profile = userMap.get(id);
    return buildDisplayName(profile);
  };

  let attachmentSignedUrl: string | null = null;

  if (record.attachment_url) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(FEEDBACK_BUCKET)
      .createSignedUrl(record.attachment_url, 60 * 60);

    if (signedError) {
      console.error("Failed to create signed URL", signedError);
    } else {
      attachmentSignedUrl = signed?.signedUrl ?? null;
    }
  }

  return {
    record: {
      id: record.id,
      subject: record.subject,
      description: record.description,
      status: record.status as FeedbackStatus,
      type: record.type as "bug" | "feature",
      email: record.email,
      created_at: record.created_at,
      updated_at: record.updated_at,
      attachment_url: record.attachment_url,
      attachment_signed_url: attachmentSignedUrl,
      created_by: record.created_by,
      reviewed_by: record.reviewed_by,
      submitted_by: formatUser(record.created_by) ?? record.email,
      reviewed_by_name: formatUser(record.reviewed_by),
    },
    comments: (comments ?? []).map((comment) => ({
      ...comment,
      author_name: formatUser(comment.user_id) ?? (comment.user_id ? "Team member" : "System"),
    })),
  };
}

export default function FeedbackAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    setCommentDraft("");
  }, [selectedFeedback]);

  const listQuery = useQuery({
    queryKey: ["admin-feedback-list", typeFilter, statusFilter],
    queryFn: () => fetchFeedbackList(typeFilter, statusFilter),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-feedback-detail", selectedFeedback],
    queryFn: () => {
      if (!selectedFeedback) throw new Error("No feedback selected");
      return fetchFeedbackDetail(selectedFeedback);
    },
    enabled: Boolean(selectedFeedback),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ feedbackId, status }: { feedbackId: string; status: FeedbackStatus }) => {
      if (!user) throw new Error("User session missing");

      const { error } = await supabase
        .from("feedback_reports")
        .update({ status, reviewed_by: user.id })
        .eq("id", feedbackId);

      if (error) {
        console.error("Failed to update status", error);
        throw new Error(error.message || "Unable to update status");
      }
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "The feedback status was updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-detail", selectedFeedback] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ feedbackId, comment }: { feedbackId: string; comment: string }) => {
      if (!user) throw new Error("User session missing");
      const trimmed = comment.trim();
      if (!trimmed) {
        throw new Error("Comment cannot be empty");
      }

      const { error } = await supabase.from("feedback_comments").insert({
        feedback_id: feedbackId,
        comment: trimmed,
        user_id: user.id,
      });

      if (error) {
        console.error("Failed to add comment", error);
        throw new Error(error.message || "Unable to add comment");
      }
    },
    onSuccess: () => {
      setCommentDraft("");
      toast({
        title: "Comment added",
        description: "Your note was shared with the reporter.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-detail", selectedFeedback] });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-list"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to add comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      if (!user) throw new Error("User session missing");
      const { error } = await supabase
        .from("feedback_reports")
        .update({ deleted_at: new Date().toISOString(), status: "closed", reviewed_by: user.id })
        .eq("id", feedbackId);

      if (error) {
        console.error("Failed to archive feedback", error);
        throw new Error(error.message || "Unable to archive feedback");
      }
    },
    onSuccess: () => {
      toast({
        title: "Feedback archived",
        description: "The submission has been archived and closed.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-detail", selectedFeedback] });
      setSelectedFeedback(null);
      setCommentDraft("");
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to archive feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      if (!user) throw new Error("User session missing");
      
      // Delete associated comments first
      const { error: commentsError } = await supabase
        .from("feedback_comments")
        .delete()
        .eq("feedback_id", feedbackId);

      if (commentsError) {
        console.error("Failed to delete feedback comments", commentsError);
        throw new Error(commentsError.message || "Unable to delete feedback comments");
      }

      // Delete the feedback report
      const { error } = await supabase
        .from("feedback_reports")
        .delete()
        .eq("id", feedbackId);

      if (error) {
        console.error("Failed to delete feedback", error);
        throw new Error(error.message || "Unable to delete feedback");
      }
    },
    onSuccess: () => {
      toast({
        title: "Feedback deleted",
        description: "The submission has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback-detail", selectedFeedback] });
      setSelectedFeedback(null);
      setCommentDraft("");
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to delete feedback",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedRecord = detailQuery.data?.record;
  const comments = detailQuery.data?.comments ?? [];

  const statusSelectValue = selectedRecord?.status ?? "open";

  const listContent = useMemo(() => {
    if (listQuery.isPending) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mb-4 h-8 w-8 animate-spin" />
          Loading feedback...
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive-foreground">Unable to load feedback</CardTitle>
            <CardDescription className="text-destructive-foreground/80">
              {listQuery.error instanceof Error ? listQuery.error.message : "Please try again shortly."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => listQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    const records = listQuery.data ?? [];

    if (records.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <Inbox className="h-10 w-10" />
          <div>
            <p className="font-medium">No feedback matches the selected filters</p>
            <p className="text-sm text-muted-foreground">
              Adjust the filters above or check back later for new submissions.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {records.map((record) => {
          const isActive = selectedFeedback === record.id;
          return (
            <button
              key={record.id}
              type="button"
              onClick={() => setSelectedFeedback(record.id)}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-left transition",
                isActive
                  ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                  : "border-border/80 hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{record.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    Submitted {formatTimestamp(record.created_at)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={typeVariant[record.type]}>{record.type === "bug" ? "Bug" : "Feature"}</Badge>
                  <Badge className={statusVariant[record.status]}>{statusLabel[record.status]}</Badge>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Reporter: {record.submitted_by ?? "Unknown"}
              </div>
            </button>
          );
        })}
      </div>
    );
  }, [listQuery, selectedFeedback]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Feedback Moderation</h1>
          <p className="text-muted-foreground">
            Review submissions, collaborate with reporters, and keep the backlog moving.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {typeFilters.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
            <CardDescription>Choose a ticket to view details.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[28rem] pr-4">{listContent}</ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Review the submission and collaborate with the reporter.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRecord ? (
              <div className="flex h-[26rem] flex-col items-center justify-center gap-3 text-muted-foreground">
                <MessageSquare className="h-10 w-10" />
                <p className="font-medium">Select a feedback ticket to get started</p>
                <p className="text-sm text-muted-foreground">
                  You can update status, leave comments, and archive submissions once selected.
                </p>
              </div>
            ) : detailQuery.isPending ? (
              <div className="flex h-[26rem] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detailQuery.isError ? (
              <div className="flex h-[26rem] flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm text-destructive">Unable to load the selected feedback. Please try again.</p>
                <Button variant="outline" onClick={() => detailQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={typeVariant[selectedRecord.type]}>{
                        selectedRecord.type === "bug" ? "Bug" : "Feature"
                      }</Badge>
                      <Badge className={statusVariant[selectedRecord.status]}>{
                        statusLabel[selectedRecord.status]
                      }</Badge>
                    </div>
                    <h2 className="text-2xl font-semibold leading-tight">{selectedRecord.subject}</h2>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatTimestamp(selectedRecord.created_at)}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserCircle2 className="h-4 w-4" />
                      Reporter: {selectedRecord.submitted_by ?? "Unknown"}
                    </div>
                    {selectedRecord.reviewed_by_name ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserCircle2 className="h-4 w-4" />
                        Reviewer: {selectedRecord.reviewed_by_name}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="status-update">Update status</Label>
                      <Select
                        value={statusSelectValue}
                        onValueChange={(value) => {
                          if (!selectedRecord) return;
                          if (value === selectedRecord.status) return;
                          statusMutation.mutate({ feedbackId: selectedRecord.id, status: value as FeedbackStatus });
                        }}
                        disabled={statusMutation.isPending}
                      >
                        <SelectTrigger id="status-update" className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusFilters
                            .filter((option) => option.value !== "all")
                            .map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => selectedRecord && archiveMutation.mutate(selectedRecord.id)}
                      disabled={archiveMutation.isPending}
                    >
                      {archiveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Archive submission
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => selectedRecord && deleteMutation.mutate(selectedRecord.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete permanently
                    </Button>
                  </div>
                </div>

                <Separator />

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {selectedRecord.description}
                  </p>
                </section>

                {selectedRecord.attachment_signed_url ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Attachment
                    </h3>
                    <a
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                      href={selectedRecord.attachment_signed_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View attachment
                    </a>
                  </section>
                ) : null}

                <Separator />

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Comments
                    </h3>
                  </div>

                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments yet. Start the conversation with the reporter.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-border/60 bg-muted/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {comment.author_name ?? "Team member"}
                            </span>
                            <span>{formatTimestamp(comment.created_at)}</span>
                          </div>
                          <p className="mt-2 text-sm text-foreground">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!selectedRecord) return;
                      commentMutation.mutate({ feedbackId: selectedRecord.id, comment: commentDraft });
                    }}
                  >
                    <Textarea
                      placeholder="Leave a note for the reporter or share internal updates."
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      className="min-h-[120px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={commentMutation.isPending || commentDraft.trim().length === 0}
                      >
                        {commentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Comment
                      </Button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
