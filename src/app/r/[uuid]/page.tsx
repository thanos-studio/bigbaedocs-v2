import ReportEditor from '@/components/ReportEditor';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  return <ReportEditor uuid={uuid} />;
}
