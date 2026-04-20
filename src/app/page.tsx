'use client';

import { Sidebar } from '@/components/Sidebar';
import { KanbanBoard } from '@/components/KanbanBoard';

export default function Home() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <KanbanBoard />
      </main>
    </>
  );
}
