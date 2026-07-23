import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAssets } from "@/app/api/clips";
import { useGalleryStore } from "@/lib/store";

export function useBoardAssets(boardId: string, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: ["assets", boardId],
    queryFn: ({ pageParam }) => fetchAssets({ boardId, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.cursor : undefined,
    enabled,
    staleTime: 60_000,
  });

  const upsertAssets = useGalleryStore((s) => s.upsertAssets);
  const ensureOrder = useGalleryStore((s) => s.ensureOrder);

  const clips = useMemo(
    () => query.data?.pages.flatMap((p) => p.data.clips) ?? [],
    [query.data]
  );
  const total = query.data?.pages[0]?.data.total ?? 0;

  useEffect(() => {
    if (!clips.length) return;
    upsertAssets(clips);
    ensureOrder(boardId, clips.map((c) => c.id));
  }, [clips, boardId, upsertAssets, ensureOrder]);

  return {
    ...query,
    total,
    loadedCount: clips.length,
  };
}
