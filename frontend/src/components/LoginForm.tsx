"use client";

import { useState, FormEvent } from 'react';
import api, { endpoints } from '@/lib/api';
import Link from 'next/link';
import { Input } from './Input';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Use the centralized api endpoints
      const response = await endpoints.auth.login({ email, password });
      login(response.data.access, response.data.refresh);

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.detail ||
          'Login failed. Check credentials or wait for approval.'
        );
      } else {
        setError('Unexpected error occurred. Try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-[--color-foreground]">Sign In</h2>
      <p className="mt-2 text-gray-600">Welcome back! Please enter your details.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <Input
          id="email"
          label="Email"
          type="email"
          Icon={Mail}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          id="password"
          label="Password"
          type="password"
          Icon={Lock}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="flex items-center gap-x-3 p-3 text-sm text-[--color-destructive] bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-5 w-5" /> <p>{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300 text-[--color-primary] focus:ring-[--color-primary]" />
            Remember me
          </label>
          <a href="#" className="font-medium text-[--color-primary] hover:underline">Forgot password?</a>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="
            w-full flex items-center justify-center gap-2
            py-3 px-4 rounded-xl
            bg-[var(--color-primary)]
            hover:bg-[var(--color-primary-hover)]
            text-white font-semibold tracking-wide
            shadow-lg hover:shadow-xl
            transition-all duration-300
            disabled:opacity-60 disabled:cursor-not-allowed
            active:scale-[0.98]
          "
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin w-5 h-5" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>

        <p className="text-center text-sm text-gray-500">
          Don’t have an account?
          <Link
            href="/signup"
            className="
              ml-1 font-semibold
              text-[var(--color-primary)]
              hover:text-[var(--color-primary-hover)]
              transition-colors duration-200
              underline-offset-4 hover:underline
            "
          >
            Create one now →
          </Link>
        </p>

      </form>
    </div>
  );
}