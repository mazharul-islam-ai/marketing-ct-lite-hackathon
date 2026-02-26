import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeneratedImage {
  id: string;
  user_id: string;
  prompt: string;
  size: string | null;
  style: string | null;
  image_url: string | null;
  storage_path: string | null;
  generation_status: string;
  generation_time_ms: number | null;
  cost_cents: number | null;
  synthid_embedded: boolean | null;
  parent_id: string | null;
  version_number: number | null;
  edit_instruction: string | null;
  created_at: string;
  expires_at: string | null;
  error_type: string | null;
  error_message: string | null;
  is_shared: boolean | null;
}

export interface GenerationResult {
  data: {
    image_url: string;
    record: GeneratedImage;
    generationTimeMs?: number;
    costCents?: number;
    cached?: boolean;
  } | null;
  error: {
    message: string;
    details?: any;
    debug?: any;
    canOverride?: boolean;
    triggeredCategories?: any[];
    type?: string;
  } | null;
}

export interface QuotaInfo {
  used: number;
  limit: number;
  hasUnlimited: boolean;
}

export const useImageGeneration = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(50);
  const [hasUnlimited, setHasUnlimited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Generate a new image
   * @param prompt - The image prompt
   * @param size - Dimensions (e.g., "1024x1024")
   * @param style - Style preset name
   * @param adminOverride - Bypass safety filters (admin only)
   * @returns Generation result with image URL or error
   */
  const generateImage = useCallback(async (
    prompt: string,
    size: string,
    style: string,
    adminOverride = false
  ): Promise<GenerationResult> => {
    // Generate client-side request ID for idempotency
    const requestId = crypto.randomUUID();
    const requestBody = { prompt, size, style, adminOverride, requestId };

    console.log("=== IMAGE GENERATION REQUEST ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Request ID:", requestId);
    console.log("Request Body:", JSON.stringify(requestBody, null, 2));

    try {
      // Check if we have a session
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("Auth session exists:", !!sessionData?.session);
      console.log("User ID:", sessionData?.session?.user?.id || "NOT LOGGED IN");

      console.log("Calling edge function: gemini-image-generator...");
      const startTime = Date.now();

      const { data, error } = await supabase.functions.invoke("gemini-image-generator", {
        body: requestBody,
      });

      const elapsed = Date.now() - startTime;
      console.log(`Response received in ${elapsed}ms`);

      if (error) {
        console.error("=== EDGE FUNCTION ERROR ===");
        console.error("Error object:", error);
        console.error("Error message:", error.message);
        console.error("Error context:", error.context);
        const errorBody = error.context?.body;
        console.error("Error body:", errorBody);

        return {
          data: null,
          error: {
            message: errorBody?.userMessage || errorBody?.message || error.message,
            details: errorBody,
            debug: errorBody?.debug,
            canOverride: errorBody?.canOverride,
            triggeredCategories: errorBody?.triggeredCategories,
            type: errorBody?.error,
          },
        };
      }

      console.log("=== SUCCESS ===");
      console.log("Response data:", data);
      return { data, error: null };
    } catch (error: any) {
      console.error("=== UNEXPECTED ERROR ===");
      console.error("Error type:", error?.name);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      console.error("Full error:", error);
      return {
        data: null,
        error: {
          message: error.message || "An unexpected error occurred",
          details: null,
        },
      };
    }
  }, []);

  /**
   * Edit an existing image using conversational instructions
   * @param parentId - ID of the image to edit
   * @param editInstruction - Natural language edit instruction
   * @param adminOverride - Bypass safety filters (admin only)
   * @returns Generation result with new version
   */
  const editImage = useCallback(async (
    parentId: string,
    editInstruction: string,
    adminOverride = false
  ): Promise<GenerationResult> => {
    try {
      const requestId = crypto.randomUUID();

      const { data, error } = await supabase.functions.invoke("image-edit", {
        body: { parentId, editInstruction, adminOverride, requestId },
      });

      if (error) {
        const errorBody = error.context?.body;
        console.error("Edit function error:", errorBody);

        return {
          data: null,
          error: {
            message: errorBody?.userMessage || errorBody?.message || error.message,
            details: errorBody,
            type: errorBody?.error,
          },
        };
      }

      return { data, error: null };
    } catch (error: any) {
      console.error("Unexpected error in editImage:", error);
      return {
        data: null,
        error: {
          message: error.message || "An unexpected error occurred",
        },
      };
    }
  }, []);

  /**
   * Get version history for an image (all ancestors and descendants)
   */
  const getVersionHistory = useCallback(async (imageId: string): Promise<GeneratedImage[]> => {
    try {
      const { data, error } = await (supabase as any).rpc("get_image_version_chain", {
        p_image_id: imageId,
      });

      if (error) {
        console.error("Error fetching version history:", error);
        return [];
      }

      return (data || []) as GeneratedImage[];
    } catch (error) {
      console.error("Unexpected error in getVersionHistory:", error);
      return [];
    }
  }, []);

  /**
   * Report a false positive content safety block
   */
  const reportFalsePositive = useCallback(async (
    imageId: string,
    prompt: string,
    reason: string
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("report-false-positive", {
        body: { imageId, prompt, reason },
      });

      if (error) {
        console.error("Error reporting false positive:", error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error: any) {
      console.error("Unexpected error in reportFalsePositive:", error);
      return {
        data: null,
        error: {
          message: error.message || "An unexpected error occurred",
        },
      };
    }
  }, []);

  /**
   * Fetch user's generated images
   */
  const fetchUserImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_generated_images")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setImages((data || []) as GeneratedImage[]);
      return { data, error: null };
    } catch (error: any) {
      console.error("Error fetching images:", error);
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get current quota usage
   */
  const getQuotaUsage = useCallback(async (): Promise<QuotaInfo> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { used: 0, limit: 50, hasUnlimited: false };

      // Get quota from user_quotas table
      const { data: quotaData } = await (supabase as any)
        .from("image_user_quotas")
        .select("current_daily_count, daily_limit, has_unlimited")
        .eq("user_id", user.id)
        .single();

      if (quotaData) {
        setQuotaUsed(quotaData.current_daily_count || 0);
        setQuotaLimit(quotaData.daily_limit || 50);
        setHasUnlimited(quotaData.has_unlimited || false);
        return {
          used: quotaData.current_daily_count || 0,
          limit: quotaData.daily_limit || 50,
          hasUnlimited: quotaData.has_unlimited || false,
        };
      }

      // Fallback: count today's completed images
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from("ai_generated_images")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("generation_status", "completed")
        .gte("created_at", today.toISOString());

      if (!error) {
        setQuotaUsed(count || 0);
      }

      return { used: count || 0, limit: 50, hasUnlimited: false };
    } catch (error: any) {
      console.error("Error getting quota:", error);
      return { used: 0, limit: 50, hasUnlimited: false };
    }
  }, []);

  /**
   * Share an image (toggle shared status)
   */
  const shareImage = useCallback(async (imageId: string, shared: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_generated_images")
        .update({ is_shared: shared })
        .eq("id", imageId);

      if (error) throw error;

      // Update local state
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, is_shared: shared } : img
        )
      );

      return { error: null };
    } catch (error: any) {
      console.error("Error sharing image:", error);
      return { error };
    }
  }, []);

  /**
   * Soft delete an image
   */
  const deleteImage = useCallback(async (imageId: string) => {
    try {
      const { error } = await supabase
        .from("ai_generated_images")
        .delete()
        .eq("id", imageId);

      if (error) throw error;

      // Remove from local state
      setImages((prev) => prev.filter((img) => img.id !== imageId));

      return { error: null };
    } catch (error: any) {
      console.error("Error deleting image:", error);
      return { error };
    }
  }, []);

  return {
    // Actions
    generateImage,
    editImage,
    getVersionHistory,
    reportFalsePositive,
    fetchUserImages,
    getQuotaUsage,
    shareImage,
    deleteImage,
    // State
    images,
    quotaUsed,
    quotaLimit,
    hasUnlimited,
    isLoading,
  };
};
