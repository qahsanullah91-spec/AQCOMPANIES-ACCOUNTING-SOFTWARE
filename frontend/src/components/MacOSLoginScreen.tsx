"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Wifi,
  Battery,
  Sliders,
  Fingerprint,
  ArrowRight,
  Eye,
  EyeOff,
  Moon,
  RotateCw,
  Power,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Shield,
  Volume2,
  Sun,
  Laptop,
} from "lucide-react";
import { useAuth, SystemUser, SYSTEM_USERS } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export function MacOSLoginScreen() {
  const {
    isLocked,
    activeTargetUser,
    setActiveTargetUser,
    login,
    biometricLogin,
    allUsers,
  } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showControlCenter, setShowControlCenter] = useState(false);

  // Simulated macOS system states
  const [isSleeping, setIsSleeping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [brightness, setBrightness] = useState(90);
  const [volume, setVolume] = useState(75);

  // Time & Date state
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Realtime clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-focus input when locked
  useEffect(() => {
    if (isLocked && !isSleeping && !isRestarting) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isLocked, isSleeping, isRestarting, activeTargetUser]);

  // Handle Caps Lock & Wake from sleep
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSleeping) {
        setIsSleeping(false);
        return;
      }
      setCapsLockActive(e.getModifierState("CapsLock"));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setCapsLockActive(e.getModifierState("CapsLock"));
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSleeping]);

  if (!isLocked) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim() && activeTargetUser.username !== "guest") {
      triggerShake("Please enter a password");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login(password, activeTargetUser);

    if (!result.success) {
      setIsSubmitting(false);
      triggerShake(result.message || "Incorrect password. Try 'admin123'");
    } else {
      setIsSubmitting(false);
      setPassword("");
    }
  };

  const triggerShake = (msg: string) => {
    setErrorMessage(msg);
    setIsShaking(true);
    setPassword("");
    setTimeout(() => {
      setIsShaking(false);
      inputRef.current?.focus();
    }, 450);
  };

  const handleTouchId = async () => {
    setIsBiometricScanning(true);
    setErrorMessage(null);
    setTimeout(async () => {
      await biometricLogin(activeTargetUser);
      setIsBiometricScanning(false);
    }, 900);
  };

  const handleRestart = () => {
    setIsRestarting(true);
    setShowShutdownModal(false);
    setTimeout(() => {
      setIsRestarting(false);
      setPassword("");
      setErrorMessage(null);
    }, 2800);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden select-none font-sans text-white transition-opacity duration-500"
      style={{
        filter: `brightness(${brightness}%)`,
      }}
    >
      {/* =========================================================
          1. DYNAMIC MACOS SEQUOIA / SONOMA WALLPAPER BACKDROP
          ========================================================= */}
      <div className="absolute inset-0 bg-[#0f172a] overflow-hidden">
        {/* Deep mesh gradient layers mimicking macOS dynamic wallpaper */}
        <div className="absolute -top-[25%] -left-[15%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-800 opacity-60 blur-[120px] animate-macos-pulse-glow" />
        <div className="absolute top-[20%] -right-[15%] w-[75vw] h-[75vw] rounded-full bg-gradient-to-br from-rose-600 via-amber-600 to-orange-700 opacity-50 blur-[130px] animate-macos-pulse-glow" />
        <div className="absolute -bottom-[20%] left-[20%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-t from-teal-500 via-emerald-600 to-cyan-800 opacity-40 blur-[140px]" />

        {/* Ambient Dark Overlay with Frosted Glass Layer */}
        <div className="absolute inset-0 bg-black/35 backdrop-blur-2xl" />

        {/* Subtle diagonal scan lines / organic glass texture */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* =========================================================
          2. SLEEP BLACKOUT OVERLAY
          ========================================================= */}
      {isSleeping && (
        <div
          onClick={() => setIsSleeping(false)}
          className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300"
        >
          <div className="text-white/40 text-xs font-medium animate-pulse">
            Click or press any key to wake
          </div>
        </div>
      )}

      {/* =========================================================
          3. RESTART ANIMATION OVERLAY
          ========================================================= */}
      {isRestarting && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center transition-all">
          {/* Apple Logo SVG */}
          <svg
            className="w-16 h-16 text-white mb-6 drop-shadow-lg"
            viewBox="0 0 170 170"
            fill="currentColor"
          >
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.66-7.88-11.9-14.39-6.3-9.69-11.19-20.94-14.67-33.75-3.48-12.82-5.22-24.69-5.22-35.63 0-14.28 3.5-26.23 10.51-35.85 7-9.61 16-14.52 26.97-14.73 4.8 0 10.02 1.34 15.66 4.02 5.63 2.68 9.53 4.09 11.69 4.23 1.95-.14 6.04-1.63 12.28-4.46 6.24-2.83 11.82-4.14 16.74-3.92 12.01.65 21.64 4.8 28.91 12.44-10.51 6.38-15.67 15.22-15.48 26.54.2 8.78 3.52 16.14 9.96 22.08 6.44 5.94 14.16 9.3 23.16 10.08-2.6 7.71-5.77 15.53-9.52 23.46zM119.22 33.56c0-6.84 2.45-13.32 7.35-19.43 4.9-6.11 11.02-10.15 18.36-12.13.22 1.2.33 2.38.33 3.55 0 6.63-2.6 13.06-7.8 19.3-5.2 6.24-11.45 10.16-18.75 11.76-.07-1.01-.11-2.03-.11-3.05z" />
          </svg>
          <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full animate-[macos-pulse-glow_2.5s_ease-in-out_infinite] w-3/4" />
          </div>
          <div className="text-white/60 text-xs mt-4 font-mono">Restarting AQ macOS...</div>
        </div>
      )}

      {/* =========================================================
          4. TOP MACOS MENU BAR
          ========================================================= */}
      <header className="absolute top-0 left-0 right-0 h-8 px-3 sm:px-4 bg-black/25 backdrop-blur-xl border-b border-white/10 flex items-center justify-between text-[11px] sm:text-xs text-white/90 z-30 font-medium tracking-tight">
        {/* Left Side: Apple Logo & App Name */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Apple Logo SVG */}
          <div className="flex items-center hover:text-white cursor-default transition-colors">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.66-7.88-11.9-14.39-6.3-9.69-11.19-20.94-14.67-33.75-3.48-12.82-5.22-24.69-5.22-35.63 0-14.28 3.5-26.23 10.51-35.85 7-9.61 16-14.52 26.97-14.73 4.8 0 10.02 1.34 15.66 4.02 5.63 2.68 9.53 4.09 11.69 4.23 1.95-.14 6.04-1.63 12.28-4.46 6.24-2.83 11.82-4.14 16.74-3.92 12.01.65 21.64 4.8 28.91 12.44-10.51 6.38-15.67 15.22-15.48 26.54.2 8.78 3.52 16.14 9.96 22.08 6.44 5.94 14.16 9.3 23.16 10.08-2.6 7.71-5.77 15.53-9.52 23.46zM119.22 33.56c0-6.84 2.45-13.32 7.35-19.43 4.9-6.11 11.02-10.15 18.36-12.13.22 1.2.33 2.38.33 3.55 0 6.63-2.6 13.06-7.8 19.3-5.2 6.24-11.45 10.16-18.75 11.76-.07-1.01-.11-2.03-.11-3.05z" />
            </svg>
          </div>
          <span className="font-semibold text-white">AQ Companies</span>
          <span className="text-white/60 hidden sm:inline">Accounting OS</span>
        </div>

        {/* Center: System Status / Security Badge */}
        <div className="hidden md:flex items-center space-x-1.5 text-white/70 text-[11px]">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>Encrypted Double-Entry Ledger</span>
        </div>

        {/* Right Side: Battery, Wi-Fi, Control Center, Clock */}
        <div className="flex items-center space-x-2.5 sm:space-x-3.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80">
            U.S.
          </span>
          <div title="Connected to AQ Cloud Ledger">
            <Wifi className="w-3.5 h-3.5 text-white/90" />
          </div>
          <div className="flex items-center space-x-1" title="Battery: 100% (Power Adapter)">
            <Battery className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] hidden sm:inline">100%</span>
          </div>

          {/* Control Center Toggle */}
          <button
            type="button"
            onClick={() => setShowControlCenter(!showControlCenter)}
            className="p-1 rounded hover:bg-white/10 text-white/90 transition-colors"
            title="Control Center"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Clock */}
          <div className="font-semibold text-white pl-1">
            <span>{currentDate}</span>
            <span className="ml-1.5">{currentTime}</span>
          </div>
        </div>
      </header>

      {/* =========================================================
          CONTROL CENTER FLYOUT (Interactive macOS Style)
          ========================================================= */}
      {showControlCenter && (
        <div className="absolute top-10 right-3 w-72 bg-slate-900/80 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-2xl z-40 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between font-bold pb-1 border-b border-white/10">
            <span>Control Center</span>
            <button
              onClick={() => setShowControlCenter(false)}
              className="text-white/50 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Toggles Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-[11px]">Wi-Fi</div>
                <div className="text-[9px] text-white/60">AQ Network</div>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center space-x-2.5 text-left hover:bg-white/15 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <div>
                <div className="font-bold text-[11px]">Appearance</div>
                <div className="text-[9px] text-white/60">{isDark ? "Dark Mode" : "Light Mode"}</div>
              </div>
            </button>
          </div>

          {/* Display Slider */}
          <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Display Brightness</span>
              </div>
              <span className="text-[10px] text-white/60">{brightness}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/20 rounded-lg cursor-pointer"
            />
          </div>

          {/* Sound Slider */}
          <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Sound Volume</span>
              </div>
              <span className="text-[10px] text-white/60">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/20 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* =========================================================
          5. MAIN CENTERPIECE: USER AVATAR & MACOS PASSWORD PILL
          ========================================================= */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 -mt-10 sm:-mt-6">
        {/* User Avatar Circle */}
        <div className="relative group cursor-pointer" onClick={() => setShowUserPicker(!showUserPicker)}>
          <div
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1.5 bg-gradient-to-tr ${activeTargetUser.avatarBg} shadow-2xl ring-4 ring-white/25 hover:ring-white/45 transition-all duration-300 flex items-center justify-center transform hover:scale-105`}
          >
            <div className="w-full h-full rounded-full bg-slate-950/40 backdrop-blur-md flex flex-col items-center justify-center text-white border border-white/20 shadow-inner">
              <span className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-md">
                {activeTargetUser.initials}
              </span>
            </div>
          </div>

          {/* Biometric Scanning Ring Effect */}
          {isBiometricScanning && (
            <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping opacity-75 pointer-events-none" />
          )}

          {/* Change user badge */}
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/30 text-white/90 shadow-lg group-hover:scale-110 transition-transform">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* User Name & System Title */}
        <div className="text-center mt-4 space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
            {activeTargetUser.full_name}
          </h1>
          <p className="text-xs sm:text-[13px] text-white/75 font-medium tracking-wide drop-shadow-sm">
            {activeTargetUser.title}
          </p>
          <div className="inline-block mt-0.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 backdrop-blur-md text-white/90 border border-white/20">
              {activeTargetUser.role} ACCESS
            </span>
          </div>
        </div>

        {/* =========================================================
            6. ICONIC MACOS SONOMA / SEQUOIA PILL PASSWORD INPUT
            ========================================================= */}
        <div className="mt-6 w-full max-w-xs flex flex-col items-center">
          <form
            onSubmit={handleSubmit}
            className={`w-full relative transition-transform duration-300 ${
              isShaking ? "animate-macos-shake" : ""
            }`}
          >
            <div
              className={`relative flex items-center bg-white/20 hover:bg-white/25 focus-within:bg-white/30 backdrop-blur-2xl rounded-full border transition-all duration-200 shadow-2xl p-1 pl-4 ${
                errorMessage
                  ? "border-rose-400 ring-2 ring-rose-400/50"
                  : "border-white/35 focus-within:border-white/70 focus-within:ring-2 focus-within:ring-white/40"
              }`}
            >
              <input
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting || isBiometricScanning}
                placeholder="Enter Password"
                autoComplete="current-password"
                className="w-full bg-transparent text-white placeholder-white/55 text-xs sm:text-sm font-medium focus:outline-none pr-8 py-1.5"
              />

              {/* Caps Lock Indicator Warning (macOS Style) */}
              {capsLockActive && (
                <div
                  title="Caps Lock is On"
                  className="mr-1 text-white/80 p-1 rounded-full bg-white/10"
                >
                  <span className="text-[11px] font-mono font-black">⇪</span>
                </div>
              )}

              {/* Toggle Password Visibility */}
              {password.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-white/60 hover:text-white mr-1 p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}

              {/* Submit Arrow Button */}
              <button
                type="submit"
                disabled={isSubmitting || isBiometricScanning}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white transition-all shadow-md shrink-0 ${
                  password.length > 0 || activeTargetUser.username === "guest"
                    ? "bg-white/40 hover:bg-white/60 active:scale-95 cursor-pointer text-white"
                    : "bg-white/10 text-white/30 cursor-default"
                }`}
                title="Log In"
              >
                {isSubmitting ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </button>
            </div>

            {/* Error Message Pill */}
            {errorMessage && (
              <div className="mt-2 text-center text-[11px] font-semibold text-rose-300 drop-shadow-sm flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>

          {/* Touch ID / Face ID Option */}
          <div className="mt-4 flex flex-col items-center space-y-2">
            <button
              type="button"
              onClick={handleTouchId}
              disabled={isBiometricScanning || isSubmitting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 backdrop-blur-md text-white/90 text-[11px] font-medium transition-all shadow-md"
            >
              <Fingerprint className={`w-3.5 h-3.5 ${isBiometricScanning ? "text-emerald-400 animate-spin" : "text-sky-300"}`} />
              <span>{isBiometricScanning ? "Verifying Biometrics..." : "Touch ID or enter password"}</span>
            </button>

            {/* Password Hint Toggle */}
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="text-[11px] text-white/60 hover:text-white/90 underline transition-colors"
            >
              {showHint ? "Hide password hint" : "Password hint?"}
            </button>

            {showHint && (
              <div className="p-2.5 rounded-xl bg-black/50 backdrop-blur-xl border border-white/15 text-[11px] text-white/80 text-center max-w-xs animate-in fade-in duration-150">
                Default: <span className="font-mono font-bold text-amber-300">admin123</span> for Ahsanullah Qureshi.
                Or select <span className="font-bold text-purple-300">Executive Auditor</span> below for instant login.
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            7. MULTI-USER SWITCHER CAROUSEL (macOS Sonoma Style)
            ========================================================= */}
        {showUserPicker && (
          <div className="mt-6 p-3 rounded-2xl bg-black/40 backdrop-blur-3xl border border-white/20 shadow-2xl flex items-center space-x-3 sm:space-x-4 animate-in fade-in zoom-in-95 duration-200">
            {allUsers.map((u) => {
              const isSelected = u.username === activeTargetUser.username;
              return (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => {
                    setActiveTargetUser(u);
                    setShowUserPicker(false);
                    setPassword("");
                    setErrorMessage(null);
                    setTimeout(() => inputRef.current?.focus(), 150);
                  }}
                  className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                    isSelected
                      ? "bg-white/20 ring-2 ring-white/50 scale-105"
                      : "hover:bg-white/10 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr ${u.avatarBg} flex items-center justify-center shadow-md`}
                  >
                    <div className="w-full h-full rounded-full bg-slate-900/50 backdrop-blur-sm flex items-center justify-center font-bold text-xs text-white">
                      {u.initials}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-white mt-1 max-w-[70px] truncate text-center">
                    {u.full_name.split(" ")[0]}
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-white/60">
                    {u.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================
          8. BOTTOM MACOS ACTION BUTTONS (Sleep, Restart, Shut Down, Switch)
          ========================================================= */}
      <footer className="absolute bottom-6 left-0 right-0 flex items-center justify-center space-x-6 sm:space-x-8 text-white/80 z-20">
        {/* Sleep */}
        <button
          type="button"
          onClick={() => setIsSleeping(true)}
          className="flex flex-col items-center group transition-transform active:scale-90"
        >
          <div className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-xl border border-white/20 flex items-center justify-center group-hover:scale-105 transition-all shadow-lg">
            <Moon className="w-4 h-4 text-white/90 group-hover:text-white" />
          </div>
          <span className="text-[11px] font-medium mt-1.5 text-white/70 group-hover:text-white">
            Sleep
          </span>
        </button>

        {/* Restart */}
        <button
          type="button"
          onClick={handleRestart}
          className="flex flex-col items-center group transition-transform active:scale-90"
        >
          <div className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-xl border border-white/20 flex items-center justify-center group-hover:scale-105 transition-all shadow-lg">
            <RotateCw className="w-4 h-4 text-white/90 group-hover:text-white" />
          </div>
          <span className="text-[11px] font-medium mt-1.5 text-white/70 group-hover:text-white">
            Restart
          </span>
        </button>

        {/* Shut Down */}
        <button
          type="button"
          onClick={() => setShowShutdownModal(true)}
          className="flex flex-col items-center group transition-transform active:scale-90"
        >
          <div className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-xl border border-white/20 flex items-center justify-center group-hover:scale-105 transition-all shadow-lg">
            <Power className="w-4 h-4 text-rose-400 group-hover:text-rose-300" />
          </div>
          <span className="text-[11px] font-medium mt-1.5 text-white/70 group-hover:text-white">
            Shut Down
          </span>
        </button>

        {/* Switch User */}
        <button
          type="button"
          onClick={() => setShowUserPicker(!showUserPicker)}
          className="flex flex-col items-center group transition-transform active:scale-90"
        >
          <div className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-xl border border-white/20 flex items-center justify-center group-hover:scale-105 transition-all shadow-lg">
            <Users className="w-4 h-4 text-white/90 group-hover:text-white" />
          </div>
          <span className="text-[11px] font-medium mt-1.5 text-white/70 group-hover:text-white">
            Switch User
          </span>
        </button>
      </footer>

      {/* =========================================================
          9. SHUTDOWN CONFIRMATION DIALOG (Authentic macOS Style)
          ========================================================= */}
      {showShutdownModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900/90 backdrop-blur-2xl border border-white/20 rounded-2xl p-5 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <Power className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Shut Down AQ Companies?</h3>
              <p className="text-xs text-white/70 mt-1">
                All ledger databases and double-entry journals are backed up. Are you sure you want to shut down now?
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShutdownModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShutdownModal(false);
                  setIsSleeping(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30"
              >
                Shut Down
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
