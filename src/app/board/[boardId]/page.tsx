import { BoardShell } from '@/components/BoardShell';

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;

  return <BoardShell boardId={boardId} />;
}
