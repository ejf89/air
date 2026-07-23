import { Gallery } from "@/components/gallery/Gallery";

// Sub-board gallery: same view as the root, scoped to one board. Client-side
// fetching here — these are in-app navigations after the shell is warm, and
// the board title travels with the link so the header paints instantly.
export default function BoardPage({
  params,
  searchParams,
}: {
  params: { boardId: string };
  searchParams: { title?: string; path?: string };
}) {
  let navPath: { id: string; title: string }[] | undefined;
  try {
    navPath = searchParams.path ? JSON.parse(searchParams.path) : undefined;
  } catch {
    navPath = undefined;
  }

  return (
    <main className="min-h-screen bg-white">
      <Gallery boardId={params.boardId} title={searchParams.title} navPath={navPath} />
    </main>
  );
}
