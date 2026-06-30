import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type KbCollection,
  type KbIndexingStatus,
  kbCollectionKey,
} from "../dataSourceConfig";

interface FileStatsRow {
  id?: string;
  embedding_count?: number | null;
  processing_status?: string | null;
  is_indexed?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
}

function deriveIndexingStatus(files: FileStatsRow[]): KbIndexingStatus {
  if (files.length === 0) return "empty";

  const statuses = files.map((f) => f.processing_status ?? "");
  const hasIndexing = statuses.some((s) =>
    ["processing", "queued", "pending"].includes(s),
  );
  if (hasIndexing) return "indexing";

  const indexedCount = files.filter(
    (f) => f.is_indexed || f.processing_status === "completed",
  ).length;
  if (indexedCount === files.length && files.length > 0) return "ready";

  const hasFailed = statuses.some((s) => s === "failed");
  if (hasFailed && indexedCount === 0) return "failed";

  return indexedCount > 0 ? "partial" : "empty";
}

function sumEmbeddingCounts(files: FileStatsRow[]): number {
  return files.reduce((sum, f) => sum + (f.embedding_count ?? 0), 0);
}

function latestTimestamp(files: FileStatsRow[], fallback: string | null): string | null {
  const fromFiles = files
    .map((f) => f.updated_at ?? f.created_at)
    .filter((v): v is string => !!v)
    .sort()
    .pop();
  return fromFiles ?? fallback;
}

function countByKey(rows: { key: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
  }
  return counts;
}

async function loadCategoryChunkCounts(
  categoryFiles: Array<FileStatsRow & { knowledge_sources: { category_id: string | null } }>,
): Promise<Map<string, number>> {
  const fileToCategory = new Map<string, string>();
  for (const file of categoryFiles) {
    const categoryId = file.knowledge_sources?.category_id;
    if (file.id && categoryId) {
      fileToCategory.set(file.id, categoryId);
    }
  }

  const { data, error } = await supabase
    .from("knowledge_embeddings" as never)
    .select("file_id");

  if (error || !data) {
    return new Map();
  }

  const rows: { key: string }[] = [];
  for (const row of data as { file_id: string }[]) {
    const categoryId = fileToCategory.get(row.file_id);
    if (categoryId) rows.push({ key: categoryId });
  }
  return countByKey(rows);
}

async function loadProjectChunkCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("project_knowledge_embeddings" as never)
    .select("project_id");

  if (error || !data) {
    return new Map();
  }

  const rows: { key: string }[] = [];
  for (const row of data as { project_id: string | null }[]) {
    if (row.project_id) rows.push({ key: row.project_id });
  }
  return countByKey(rows);
}

export function useKbCollections() {
  const [collections, setCollections] = useState<{
    categories: KbCollection[];
    brands: KbCollection[];
    projects: KbCollection[];
  }>({ categories: [], brands: [], projects: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        categoriesRes,
        categoryFilesRes,
        brandsRes,
        brandFilesRes,
        projectsRes,
        projectFilesRes,
      ] = await Promise.all([
        supabase
          .from("knowledge_base_categories" as never)
          .select("id, name, last_synced, is_active")
          .eq("is_active" as never, true)
          .order("name"),
        supabase
          .from("knowledge_files" as never)
          .select(
            "id, processing_status, is_indexed, updated_at, knowledge_sources!inner(category_id)",
          ),
        supabase
          .from("brands" as never)
          .select("id, name, slug")
          .eq("is_active" as never, true)
          .order("name"),
        supabase
          .from("brand_knowledge_files" as never)
          .select(
            "brand_id, embedding_count, processing_status, is_indexed, updated_at",
          ),
        supabase
          .from("projects" as never)
          .select("id, name, slug")
          .order("name"),
        supabase
          .from("project_knowledge_files" as never)
          .select("id, project_id, processing_status, created_at"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (categoryFilesRes.error) throw categoryFilesRes.error;
      if (brandsRes.error) throw brandsRes.error;
      if (brandFilesRes.error) throw brandFilesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (projectFilesRes.error) throw projectFilesRes.error;

      type CategoryFileRow = FileStatsRow & {
        knowledge_sources: { category_id: string | null };
      };
      const categoryFiles = (categoryFilesRes.data ?? []) as CategoryFileRow[];
      const filesByCategory = new Map<string, FileStatsRow[]>();
      for (const file of categoryFiles) {
        const categoryId = file.knowledge_sources?.category_id;
        if (!categoryId) continue;
        const list = filesByCategory.get(categoryId) ?? [];
        list.push(file);
        filesByCategory.set(categoryId, list);
      }

      type BrandFileRow = FileStatsRow & { brand_id: string };
      const brandFiles = (brandFilesRes.data ?? []) as BrandFileRow[];
      const filesByBrand = new Map<string, FileStatsRow[]>();
      for (const file of brandFiles) {
        const list = filesByBrand.get(file.brand_id) ?? [];
        list.push(file);
        filesByBrand.set(file.brand_id, list);
      }

      type ProjectFileRow = FileStatsRow & { project_id: string | null };
      const projectFiles = (projectFilesRes.data ?? []) as ProjectFileRow[];
      const filesByProject = new Map<string, FileStatsRow[]>();
      for (const file of projectFiles) {
        if (!file.project_id) continue;
        const list = filesByProject.get(file.project_id) ?? [];
        list.push(file);
        filesByProject.set(file.project_id, list);
      }

      const [categoryChunkCounts, projectChunkCounts] = await Promise.all([
        loadCategoryChunkCounts(categoryFiles),
        loadProjectChunkCounts(),
      ]);

      const categories: KbCollection[] = (
        (categoriesRes.data ?? []) as {
          id: string;
          name: string;
          last_synced: string | null;
        }[]
      ).map((cat) => {
        const files = filesByCategory.get(cat.id) ?? [];
        const chunkCount = categoryChunkCounts.get(cat.id) ?? 0;
        return {
          key: kbCollectionKey("category", cat.id),
          type: "category" as const,
          id: cat.id,
          name: cat.name,
          fileCount: files.length,
          chunkCount,
          status: deriveIndexingStatus(files),
          lastIndexed: latestTimestamp(files, cat.last_synced),
          manageUrl: "/adminpanel/knowledgebase",
        };
      });

      const brands: KbCollection[] = (
        (brandsRes.data ?? []) as { id: string; name: string; slug: string }[]
      ).map((brand) => {
        const files = filesByBrand.get(brand.id) ?? [];
        return {
          key: kbCollectionKey("brand", brand.id),
          type: "brand" as const,
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          fileCount: files.length,
          chunkCount: sumEmbeddingCounts(files),
          status: deriveIndexingStatus(files),
          lastIndexed: latestTimestamp(files, null),
          manageUrl: `/brands/${brand.id}/knowledge`,
        };
      });

      const projects: KbCollection[] = (
        (projectsRes.data ?? []) as { id: string; name: string; slug: string }[]
      ).map((project) => {
        const files = filesByProject.get(project.id) ?? [];
        const chunkCount = projectChunkCounts.get(project.id) ?? 0;
        return {
          key: kbCollectionKey("project", project.id),
          type: "project" as const,
          id: project.id,
          name: project.name,
          slug: project.slug,
          fileCount: files.length,
          chunkCount,
          status: deriveIndexingStatus(files),
          lastIndexed: latestTimestamp(files, null),
          manageUrl: `/projects/${project.slug}/knowledge`,
        };
      });

      setCollections({ categories, brands, projects });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge bases");
      setCollections({ categories: [], brands: [], projects: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { collections, isLoading, error, reload: load };
}
