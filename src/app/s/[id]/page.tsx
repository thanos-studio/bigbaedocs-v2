import SharedApplication from '@/components/SharedApplication';

export default async function SharedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SharedApplication id={id} />;
}
