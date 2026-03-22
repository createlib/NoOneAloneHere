import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [{ id: '[id]' }];
}

export default function Page({ params }: { params: { id: string } }) {
  return <ClientPage params={params} />;
}
