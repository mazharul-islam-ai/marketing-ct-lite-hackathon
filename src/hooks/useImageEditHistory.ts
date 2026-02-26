import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GeneratedImage } from "./useImageGeneration";

/**
 * Hook for managing image version history
 */
export function useImageEditHistory() {
  const [versionHistory, setVersionHistory] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the complete version chain for an image
   * Uses recursive CTE to get all ancestors
   */
  const fetchVersionChain = useCallback(async (imageId: string): Promise<GeneratedImage[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to use the database function first
      const { data: chainData, error: rpcError } = await (supabase as any).rpc(
        "get_image_version_chain",
        { p_image_id: imageId }
      );

      if (!rpcError && chainData && chainData.length > 0) {
        const versions = chainData as GeneratedImage[];
        setVersionHistory(versions);
        return versions;
      }

      // Fallback: manually traverse the chain
      const versions: GeneratedImage[] = [];
      let currentId: string | null = imageId;
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);

        const { data: imageData, error: fetchError } = await (supabase as any)
          .from("ai_generated_images")
          .select("*")
          .eq("id", currentId)
          .is("deleted_at", null)
          .single();

        if (fetchError || !imageData) break;

        versions.push(imageData as GeneratedImage);
        currentId = (imageData as any).parent_id;
      }

      // Reverse to get oldest first
      versions.reverse();
      setVersionHistory(versions);
      return versions;
    } catch (err) {
      console.error("Error fetching version chain:", err);
      setError("Failed to load version history");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch all descendants (children, grandchildren, etc.) of an image
   */
  const fetchDescendants = useCallback(async (imageId: string): Promise<GeneratedImage[]> => {
    setIsLoading(true);

    try {
      // Try database function
      const { data: childrenData, error: rpcError } = await (supabase as any).rpc(
        "get_image_children",
        { p_image_id: imageId }
      );

      if (!rpcError && childrenData) {
        return childrenData as GeneratedImage[];
      }

      // Fallback: simple query for direct children
      const { data, error: fetchError } = await (supabase as any)
        .from("ai_generated_images")
        .select("*")
        .eq("parent_id", imageId)
        .is("deleted_at", null)
        .order("version_number", { ascending: true });

      if (fetchError) throw fetchError;
      return (data || []) as GeneratedImage[];
    } catch (err) {
      console.error("Error fetching descendants:", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get the root (original) image of a version chain
   */
  const getRootImage = useCallback(async (imageId: string): Promise<GeneratedImage | null> => {
    const chain = await fetchVersionChain(imageId);
    return chain.length > 0 ? chain[0] : null;
  }, [fetchVersionChain]);

  /**
   * Get the latest version in a chain
   */
  const getLatestVersion = useCallback(async (imageId: string): Promise<GeneratedImage | null> => {
    const chain = await fetchVersionChain(imageId);
    if (chain.length === 0) return null;

    const root = chain[0];
    const descendants = await fetchDescendants(root.id);

    if (descendants.length === 0) return root;

    // Find the highest version number
    return descendants.reduce((latest, current) => {
      const latestVersion = latest.version_number || 1;
      const currentVersion = current.version_number || 1;
      return currentVersion > latestVersion ? current : latest;
    }, descendants[0]);
  }, [fetchVersionChain, fetchDescendants]);

  /**
   * Check if an image has any edits (children)
   */
  const hasEdits = useCallback(async (imageId: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from("ai_generated_images")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", imageId)
      .is("deleted_at", null);

    return !error && (count || 0) > 0;
  }, []);

  /**
   * Get full history including both ancestors and descendants
   */
  const getFullHistory = useCallback(async (imageId: string): Promise<GeneratedImage[]> => {
    const ancestors = await fetchVersionChain(imageId);
    if (ancestors.length === 0) return [];

    const root = ancestors[0];
    const descendants = await fetchDescendants(root.id);

    // Combine and sort by version number
    const allVersions = [...ancestors];
    for (const desc of descendants) {
      if (!allVersions.find((v) => v.id === desc.id)) {
        allVersions.push(desc);
      }
    }

    return allVersions.sort((a, b) => (a.version_number || 1) - (b.version_number || 1));
  }, [fetchVersionChain, fetchDescendants]);

  return {
    versionHistory,
    isLoading,
    error,
    fetchVersionChain,
    fetchDescendants,
    getRootImage,
    getLatestVersion,
    hasEdits,
    getFullHistory,
  };
}
