import { useQuery } from "@tanstack/react-query";
import { fetchBoards } from "@/app/api/boards";

export function useBoardChildren(boardId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["boards", boardId],
    queryFn: () => fetchBoards(boardId),
    enabled,
    staleTime: 60_000,
  });
}
