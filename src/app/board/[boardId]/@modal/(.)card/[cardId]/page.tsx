import { CardModalRoute } from '@/components/CardModalRoute';

export default async function CardModalPage({
  params,
}: {
  params: Promise<{ boardId: string; cardId: string }>;
}) {
  const { boardId, cardId } = await params;

  return <CardModalRoute boardId={boardId} cardId={cardId} />;
}
