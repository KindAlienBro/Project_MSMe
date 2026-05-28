// frontend/src/app/login/page.tsx
import LoginForm from '@/components/LoginForm';
import { GanttChartSquare } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2">
        {/* Branding Panel */}
        <div className="hidden bg-slate-800 p-12 text-white md:flex md:flex-col md:justify-between">
          <div className="flex items-center gap-4">
            <Image src="/logo.jpeg" alt="MSMe Logo" width={48} height={48} className="rounded-xl shadow-md" priority />
            <span className="text-2xl font-bold">Automatic Timetable</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Unlock a new level of academic organization.
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              The intelligent platform designed for educators and administrators.
            </p>
          </div>
          <div className="text-sm text-slate-400">&copy; 2024 Automatic Timetable. All Rights Reserved.</div>
        </div>

        {/* Form Panel */}
        <div className="bg-[--color-card] p-8 md:p-12">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}