"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />;
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg border border-[--color-border] bg-[var(--color-background)] hover:bg-[var(--color-accent)] transition-colors relative flex items-center justify-center w-9 h-9"
            aria-label="Toggle theme"
        >
            <Sun className={`h-4 w-4 transition-all duration-300 ${theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'} text-gray-700`} />
            <Moon className={`absolute h-4 w-4 transition-all duration-300 ${theme === 'dark' ? 'rotate-0 scale-100' : 'rotate-90 scale-0'} text-gray-300`} />
        </button>
    );
}
