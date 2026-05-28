import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Custom app theme matching the web design's indigo-purple palette and clean white aesthetic.
class AppTheme {
  AppTheme._();

  // ── Colours ────────────────────────────────────────────────────────
  static const Color _primaryLight = Color(0xFF4F46E5); // indigo-600
  static const Color _primaryDark = Color(0xFF818CF8);  // indigo-400
  static const Color _secondary = Color(0xFF9333EA);    // purple-600

  static const Color _bgLight = Color(0xFFF9FAFB);      // gray-50
  static const Color _surfaceLight = Colors.white;
  
  static const Color _bgDark = Color(0xFF0F172A);       // slate-900
  static const Color _surfaceDark = Color(0xFF1E293B);  // slate-800
  
  static const Color _errorColor = Color(0xFFEF4444);   // red-500
  static const Color _successColor = Color(0xFF22C55E); // green-500

  // Gradient used on primary buttons.
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF4F46E5), Color(0xFF9333EA)],
  );

  // ── Light theme ────────────────────────────────────────────────────
  static ThemeData get lightTheme => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: const ColorScheme.light(
          primary: _primaryLight,
          secondary: _secondary,
          surface: _surfaceLight,
          error: _errorColor,
        ),
        scaffoldBackgroundColor: _bgLight,
        textTheme: GoogleFonts.interTextTheme().apply(
          bodyColor: const Color(0xFF1E293B), // slate-800
          displayColor: const Color(0xFF0F172A), // slate-900
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: _bgLight,
          foregroundColor: const Color(0xFF0F172A), // slate-900
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F172A),
          ),
          iconTheme: const IconThemeData(color: Color(0xFF475569)), // slate-600
        ),
        cardTheme: CardThemeData(
          color: _surfaceLight,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.grey.shade200),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _primaryLight, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          hintStyle: const TextStyle(color: Color(0xFF94A3B8)), // slate-400
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            backgroundColor: _primaryLight,
            foregroundColor: Colors.white,
            textStyle: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            elevation: 0,
          ),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: _surfaceLight,
          selectedItemColor: _primaryLight,
          unselectedItemColor: Color(0xFF94A3B8), // slate-400
          elevation: 8,
          type: BottomNavigationBarType.fixed,
        ),
      );

  // ── Dark theme ─────────────────────────────────────────────────────
  // (Kept for compatibility, but primary focus is on Light theme for clean look)
  static ThemeData get darkTheme => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(
          primary: _primaryDark,
          secondary: _secondary,
          surface: _surfaceDark,
          error: _errorColor,
        ),
        scaffoldBackgroundColor: _bgDark,
        textTheme: GoogleFonts.interTextTheme().apply(
          bodyColor: const Color(0xFFE2E8F0), // slate-200
          displayColor: Colors.white,
        ),
        appBarTheme: AppBarTheme(
          backgroundColor: _bgDark,
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false,
          titleTextStyle: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        cardTheme: CardThemeData(
          color: _surfaceDark,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF334155)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E293B),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF475569)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF475569)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _primaryLight, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            backgroundColor: _primaryLight,
            foregroundColor: Colors.white,
            textStyle: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
            elevation: 0,
          ),
        ),
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: _surfaceDark,
          selectedItemColor: _primaryDark,
          unselectedItemColor: Color(0xFF64748B),
          type: BottomNavigationBarType.fixed,
        ),
      );

  // Convenience getters.
  static Color get success => _successColor;
  static Color get error => _errorColor;
}
