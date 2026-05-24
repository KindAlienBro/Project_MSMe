"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { endpoints } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface TeacherProfile {
    dept_name: string;
    designation: string;
    phone: string;
}

interface StudentProfile {
    dept_name: string;
    semester: number;
    year: number;
    register_number: string | null;
}

interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    profile_photo: string | null;
    teacher_profile?: TeacherProfile;
    student_profile?: StudentProfile;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string, refreshToken: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const fetchUser = async () => {
        try {
            const response = await endpoints.auth.me();
            setUser(response.data);
        } catch (error) {
            console.error("Failed to fetch user details", error);
            // If fetching user fails (e.g., token invalid), logout
            logout();
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    await fetchUser();
                } catch (error) {
                    console.error("Auth check failed", error);
                    logout();
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (token: string, refreshToken: string) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        await fetchUser();
        router.push('/dashboard');
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        router.push('/login');
    };

    // Protected Route Logic
    useEffect(() => {
        if (!loading) {
            const isAuth = !!localStorage.getItem('access_token');
            const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/signup';

            if (!isAuth && !isPublicPage) {
                router.push('/login');
            } else if (isAuth && (pathname === '/login' || pathname === '/signup')) {
                router.push('/dashboard');
            }
        }
    }, [loading, pathname, router]);


    return (
        <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
