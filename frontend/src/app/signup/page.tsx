// frontend/src/app/signup/page.tsx
import SignupForm from '@/components/SignupForm';
import { GanttChartSquare } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl shadow-2xl md:grid-cols-2">
        {/* Branding Panel */}
        <div className="hidden bg-slate-800 p-12 text-white md:flex md:flex-col md:justify-between">
          <div className="flex items-center gap-3">
            <GanttChartSquare size={32} className="text-[--color-primary]" />
            <span className="text-2xl font-bold">Automatic Timetable</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Start your journey to organized scheduling.
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Create your account in seconds and experience the future of academic management.
            </p>
          </div>
          <div className="text-sm text-slate-400">&copy; 2024 Automatic Timetable. All Rights Reserved.</div>
        </div>

        {/* Form Panel */}
        <div className="bg-[--color-card] p-8 md:p-12">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}