import ApplicationEditor from '@/components/ApplicationEditor';

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  return <ApplicationEditor uuid={uuid} />;
}
