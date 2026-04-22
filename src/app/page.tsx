'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useApp } from '@/context/AppContext';

export default function Home() {
  const router = useRouter();
  const { user, authLoading } = useApp();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return <main className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading...</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <KanbanBoard />
      </main>
    </>
  );
}
