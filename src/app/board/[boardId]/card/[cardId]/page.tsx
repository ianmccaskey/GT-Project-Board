import { BoardShell } from '@/components/BoardShell';
import { CardModalRoute } from '@/components/CardModalRoute';

export default async function CardPage({
  params,
}: {
  params: Promise<{ boardId: string; cardId: string }>;
}) {
  const { boardId, cardId } = await params;

  return (
    <>
      <BoardShell boardId={boardId} />
      <CardModalRoute boardId={boardId} cardId={cardId} />
    </>
  );
}
