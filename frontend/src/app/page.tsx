"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Zap,
  ArrowRight,
  GanttChartSquare,
  Sparkles,
  BookOpen,
  UserCheck,
  Bell,
  GripVertical,
  BarChart3,
  Menu,
  X,
  ArrowUpRight,
  Layers,
  Shield,
} from "lucide-react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafbff] text-gray-900 overflow-x-hidden selection:bg-blue-600/20">
      {/* ── NAVBAR ────────────────────────────────────────────────── */}
      <nav
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-white/70 backdrop-blur-2xl border-b border-gray-200/40 shadow-[0_2px_24px_rgba(0,0,0,.04)]"
            : ""
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8 h-[72px]">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:shadow-blue-600/40 transition-shadow duration-300">
              <GanttChartSquare className="h-[18px] w-[18px] text-white" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-gray-900">
              Automatic Timetable Generator
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#process" },
              { label: "Built For", href: "#roles" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-[14px] font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100/60 transition-all duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            <Link
              href="/login"
              className="px-5 py-2.5 text-[14px] font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100/60 transition-all duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 text-[14px] font-semibold text-white rounded-xl bg-gray-900 hover:bg-gray-800 transition-all duration-200 shadow-sm"
            >
              Get Started
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 -mr-2 text-gray-600"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-xl animate-in slide-in-from-top-2">
            <div className="px-6 pb-6 pt-2 space-y-1">
              {[
                { label: "Features", href: "#features" },
                { label: "How It Works", href: "#process" },
                { label: "Built For", href: "#roles" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-[15px] font-medium text-gray-600 hover:text-gray-900 rounded-lg"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-3">
                <Link href="/login" className="flex-1 text-center py-2.5 text-[14px] font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Sign In
                </Link>
                <Link href="/signup" className="flex-1 text-center py-2.5 text-[14px] font-semibold text-white bg-gray-900 rounded-xl">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-32 md:pt-48 md:pb-40 px-6 lg:px-8">
        {/* Subtle background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-b from-blue-100/60 via-indigo-50/40 to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-purple-100/40 to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-white px-4 py-1.5 text-[13px] font-medium text-blue-700 shadow-sm mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Academic Scheduling
          </div>

          {/* Main heading */}
          <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-extrabold leading-[1.08] tracking-tight text-gray-950">
            Intelligent scheduling
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              for modern institutions
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto font-normal">
            Generate conflict-free timetables, manage faculty leaves and
            substitutions, and keep your entire institution in sync — from one
            unified platform.
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gray-950 px-7 py-4 text-[15px] font-semibold text-white shadow-xl shadow-gray-950/10 hover:shadow-gray-950/20 hover:bg-gray-800 transition-all duration-300"
            >
              Create Your Schedule
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-7 py-4 text-[15px] font-medium text-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>

        {/* ── Hero visual: Timetable Preview Card ─────────────────── */}
        <div className="relative z-10 mx-auto mt-20 max-w-5xl">
          <div className="rounded-2xl border border-gray-200/60 bg-white shadow-2xl shadow-gray-200/40 overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                <div className="h-3 w-3 rounded-full bg-green-400/80" />
              </div>
              <div className="ml-3 flex-1 max-w-sm">
                <div className="h-6 rounded-md bg-gray-100 flex items-center justify-center text-[11px] text-gray-400 font-medium">
                  autotimetable.app/dashboard
                </div>
              </div>
            </div>

            {/* Mock timetable grid */}
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Weekly Timetable</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Computer Science — Semester VI</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-6 gap-[1px] bg-gray-100 rounded-xl overflow-hidden text-[11px]">
                {/* Header Row */}
                {["Time", "Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <div key={d} className="bg-gray-50 px-3 py-2.5 font-semibold text-gray-500 text-center uppercase tracking-wider text-[10px]">
                    {d}
                  </div>
                ))}

                {/* Row 1 */}
                <div className="bg-white px-3 py-3 text-gray-400 font-medium text-center">9:00</div>
                <div className="bg-blue-50 px-3 py-3 text-blue-700 font-semibold text-center rounded-none">
                  <div>AI/ML</div><div className="text-[9px] text-blue-500 font-normal mt-0.5">Dr. Sharma</div>
                </div>
                <div className="bg-violet-50 px-3 py-3 text-violet-700 font-semibold text-center">
                  <div>DBMS</div><div className="text-[9px] text-violet-500 font-normal mt-0.5">Prof. Kumar</div>
                </div>
                <div className="bg-emerald-50 px-3 py-3 text-emerald-700 font-semibold text-center">
                  <div>OS Lab</div><div className="text-[9px] text-emerald-500 font-normal mt-0.5">Lab 301</div>
                </div>
                <div className="bg-blue-50 px-3 py-3 text-blue-700 font-semibold text-center">
                  <div>CN</div><div className="text-[9px] text-blue-500 font-normal mt-0.5">Dr. Patel</div>
                </div>
                <div className="bg-amber-50 px-3 py-3 text-amber-700 font-semibold text-center">
                  <div>Elective</div><div className="text-[9px] text-amber-500 font-normal mt-0.5">DevOps</div>
                </div>

                {/* Row 2 */}
                <div className="bg-white px-3 py-3 text-gray-400 font-medium text-center">10:00</div>
                <div className="bg-violet-50 px-3 py-3 text-violet-700 font-semibold text-center">
                  <div>DBMS</div><div className="text-[9px] text-violet-500 font-normal mt-0.5">Prof. Kumar</div>
                </div>
                <div className="bg-blue-50 px-3 py-3 text-blue-700 font-semibold text-center">
                  <div>AI/ML</div><div className="text-[9px] text-blue-500 font-normal mt-0.5">Dr. Sharma</div>
                </div>
                <div className="bg-emerald-50 px-3 py-3 text-emerald-700 font-semibold text-center">
                  <div>OS Lab</div><div className="text-[9px] text-emerald-500 font-normal mt-0.5">Lab 301</div>
                </div>
                <div className="bg-rose-50 px-3 py-3 text-rose-700 font-semibold text-center">
                  <div>SE</div><div className="text-[9px] text-rose-500 font-normal mt-0.5">Dr. Joshi</div>
                </div>
                <div className="bg-white px-3 py-3 text-gray-300 text-center italic">Free</div>

                {/* Row 3 */}
                <div className="bg-white px-3 py-3 text-gray-400 font-medium text-center">11:00</div>
                <div className="bg-emerald-50 px-3 py-3 text-emerald-700 font-semibold text-center">
                  <div>CN Lab</div><div className="text-[9px] text-emerald-500 font-normal mt-0.5">Lab 204</div>
                </div>
                <div className="bg-emerald-50 px-3 py-3 text-emerald-700 font-semibold text-center">
                  <div>CN Lab</div><div className="text-[9px] text-emerald-500 font-normal mt-0.5">Lab 204</div>
                </div>
                <div className="bg-rose-50 px-3 py-3 text-rose-700 font-semibold text-center">
                  <div>SE</div><div className="text-[9px] text-rose-500 font-normal mt-0.5">Dr. Joshi</div>
                </div>
                <div className="bg-amber-50 px-3 py-3 text-amber-700 font-semibold text-center">
                  <div>Elective</div><div className="text-[9px] text-amber-500 font-normal mt-0.5">GenAI</div>
                </div>
                <div className="bg-blue-50 px-3 py-3 text-blue-700 font-semibold text-center">
                  <div>AI/ML</div><div className="text-[9px] text-blue-500 font-normal mt-0.5">Dr. Sharma</div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating accent cards */}
          <div className="absolute -left-4 top-1/3 hidden lg:block">
            <div className="rounded-xl bg-white border border-gray-200/60 shadow-xl shadow-gray-200/30 px-4 py-3 flex items-center gap-3 animate-[bounce_6s_ease-in-out_infinite]">
              <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                <Shield className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-gray-900">Zero Conflicts</div>
                <div className="text-[10px] text-gray-400">AI-verified schedule</div>
              </div>
            </div>
          </div>

          <div className="absolute -right-4 top-1/2 hidden lg:block">
            <div className="rounded-xl bg-white border border-gray-200/60 shadow-xl shadow-gray-200/30 px-4 py-3 flex items-center gap-3 animate-[bounce_7s_ease-in-out_infinite_1s]">
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-gray-900">Instant Generation</div>
                <div className="text-[10px] text-gray-400">Ready in seconds</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" className="py-28 md:py-36 px-6 lg:px-8 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-[13px] font-medium text-gray-600 mb-6">
              <Layers className="h-3.5 w-3.5" />
              Core Capabilities
            </div>
            <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight text-gray-950 leading-tight">
              Built for every part of
              <br className="hidden sm:block" />
              academic scheduling
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Sparkles,
                title: "AI Generation",
                desc: "Automatically generate optimized, conflict-free timetables that respect faculty constraints, room availability, and lab requirements.",
                color: "blue",
              },
              {
                icon: GripVertical,
                title: "Drag & Drop Editor",
                desc: "Fine-tune schedules visually. Move classes, labs, and electives across time slots with group-aware conflict detection.",
                color: "violet",
              },
              {
                icon: UserCheck,
                title: "Leave & Substitution",
                desc: "Faculty can request leaves, admins approve them, and the system automatically assigns substitute teachers with notifications.",
                color: "emerald",
              },
              {
                icon: Bell,
                title: "Smart Notifications",
                desc: "Real-time alerts for schedule changes, substitution requests, and leave approvals delivered to the right people.",
                color: "orange",
              },
              {
                icon: BarChart3,
                title: "Version History",
                desc: "Track every change. Compare timetable versions side-by-side and revert to any previous state with one click.",
                color: "rose",
              },
              {
                icon: BookOpen,
                title: "Role-Based Access",
                desc: "Dedicated dashboards for administrators, teachers, and students — each with the tools and views they need.",
                color: "indigo",
              },
            ].map((f) => {
              const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
                blue: { bg: "bg-blue-50", icon: "text-blue-600", border: "group-hover:border-blue-200" },
                violet: { bg: "bg-violet-50", icon: "text-violet-600", border: "group-hover:border-violet-200" },
                emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "group-hover:border-emerald-200" },
                orange: { bg: "bg-orange-50", icon: "text-orange-600", border: "group-hover:border-orange-200" },
                rose: { bg: "bg-rose-50", icon: "text-rose-600", border: "group-hover:border-rose-200" },
                indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", border: "group-hover:border-indigo-200" },
              };
              const c = colorMap[f.color];
              return (
                <div
                  key={f.title}
                  className={`group rounded-2xl border border-gray-100 bg-white p-7 hover:shadow-lg hover:shadow-gray-100/80 ${c.border} transition-all duration-300 hover:-translate-y-0.5`}
                >
                  <div className={`h-11 w-11 rounded-xl ${c.bg} flex items-center justify-center mb-5`}>
                    <f.icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                  <h3 className="text-[16px] font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-[14px] text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section id="process" className="py-28 md:py-36 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-[13px] font-medium text-gray-600 mb-6">
              <Zap className="h-3.5 w-3.5" />
              Simple Process
            </div>
            <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight text-gray-950 leading-tight">
              From data to schedule
              <br className="hidden sm:block" />
              in three steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
            {[
              {
                step: "01",
                icon: Calendar,
                title: "Configure",
                desc: "Add your faculty, subjects, rooms, and scheduling constraints through an intuitive interface.",
              },
              {
                step: "02",
                icon: Zap,
                title: "Generate",
                desc: "Our AI engine processes constraints and generates an optimized schedule with zero conflicts.",
              },
              {
                step: "03",
                icon: Users,
                title: "Collaborate",
                desc: "Share with your team. Manage leaves, substitutions, and updates through a unified dashboard.",
              },
            ].map((step, i) => (
              <div key={step.step} className="relative text-center md:text-left">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-gray-200 to-gray-100" />
                )}

                <div className="flex flex-col items-center md:items-start">
                  <div className="relative mb-6">
                    <div className="h-16 w-16 rounded-2xl bg-gray-950 flex items-center justify-center shadow-lg shadow-gray-950/10">
                      <step.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="absolute -top-1.5 -right-1.5 h-7 w-7 rounded-full bg-blue-600 text-[11px] font-bold text-white flex items-center justify-center shadow-md">
                      {step.step}
                    </div>
                  </div>
                  <h3 className="text-[17px] font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-[14px] text-gray-500 leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR ─────────────────────────────────────────────── */}
      <section id="roles" className="py-28 md:py-36 px-6 lg:px-8 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-[13px] font-medium text-gray-600 mb-6">
              <Users className="h-3.5 w-3.5" />
              For Everyone
            </div>
            <h2 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tight text-gray-950 leading-tight">
              One platform, every role
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
              Tailored experiences for every stakeholder in your institution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                role: "Administrators",
                desc: "Full control over timetable generation, faculty management, data configuration, and institutional settings.",
                features: ["Generate timetables", "Manage faculty data", "Approve leave requests", "View change history"],
                gradient: "from-blue-600 to-indigo-700",
              },
              {
                role: "Teachers",
                desc: "View personalized schedules, request leaves, accept or decline substitution assignments, and track changes.",
                features: ["Personal timetable view", "Leave request system", "Substitution management", "Real-time notifications"],
                gradient: "from-violet-600 to-purple-700",
              },
              {
                role: "Students",
                desc: "Access up-to-date class schedules, receive notifications about changes, and stay informed about substitutions.",
                features: ["Weekly timetable view", "Change notifications", "Substitution alerts", "Department schedule"],
                gradient: "from-emerald-600 to-teal-700",
              },
            ].map((role) => (
              <div
                key={role.role}
                className="group rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-xl hover:shadow-gray-100/80 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className={`h-1.5 bg-gradient-to-r ${role.gradient}`} />
                <div className="p-7">
                  <h3 className="text-[18px] font-bold text-gray-900 mb-2">{role.role}</h3>
                  <p className="text-[14px] text-gray-500 leading-relaxed mb-6">{role.desc}</p>
                  <ul className="space-y-2.5">
                    {role.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-[13px] text-gray-600">
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-28 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-3xl bg-gray-950 px-8 py-20 md:px-16 text-center overflow-hidden">
            {/* Decorative gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-3xl" />
              <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-indigo-600/15 blur-3xl" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Ready to simplify your
                <br className="hidden sm:block" />
                institution&apos;s scheduling?
              </h2>
              <p className="mt-4 text-[16px] text-gray-400 max-w-lg mx-auto leading-relaxed">
                Set up your first timetable in minutes. No complex configuration required.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-[15px] font-semibold text-gray-900 shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  Get Started
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-7 py-4 text-[15px] font-medium text-white hover:bg-white/5 transition-all duration-300"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200/60 bg-white px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <GanttChartSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-gray-900">AutoTimetable</span>
          </div>
          <p className="text-[13px] text-gray-400">
            &copy; {new Date().getFullYear()} AutoTimetable. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}