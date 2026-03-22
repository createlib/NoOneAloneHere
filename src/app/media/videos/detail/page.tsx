import ClientPage from './ClientPage';
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-texture flex items-center justify-center text-[#a09080] font-bold tracking-widest">Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}
