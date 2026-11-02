import { useParams } from 'react-router-dom';
import ResourcePage from '@/components/resource/ResourcePage';
import { REPORTS } from '@/config/reports';
import NotFoundPage from '@/pages/NotFoundPage';

export default function ReportPage() {
  const { slug } = useParams();
  const config = REPORTS[slug];
  if (!config) return <NotFoundPage />;
  return <ResourcePage key={slug} config={config} />;
}
