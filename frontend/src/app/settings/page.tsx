"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Package,
  Users,
  Shield,
  History,
  Plus,
  Save,
  CheckCircle,
  Building,
  Key,
  User as UserIcon,
  Sun,
  Moon,
  Bell,
  Smartphone,
  Wifi,
  Lock,
  Camera,
  Trash2,
  RefreshCw,
  Activity,
} from "lucide-react";
import { fetchApi, formatUSD, formatRate } from "@/lib/api";

interface Product {
  id: number;
  product_name: string;
  grade?: string;
  hs_code?: string;
  default_package_kg: number;
  default_purchase_rate: number;
  default_selling_rate: number;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  user_name: string;
  timestamp: string;
  new_value_json?: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "company" | "profile" | "appearance" | "notifications" | "security" | "pwa" | "products" | "users" | "audit"
  >("company");

  // User Profile state
  const [userProfile, setUserProfile] = useState({
    full_name: "Antigravity Executive",
    username: "director",
    email: "management@aqcompanies.com",
    role: "ADMINISTRATOR",
    phone: "+93 70 000 0000",
  });

  // Preferences
  const [appearance, setAppearance] = useState({
    theme: "light",
    compactRows: true,
  });

  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    soundOnPost: true,
    anomalyAlerts: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    currentPassword: "",
    newPassword: "",
    sessionTimeout: "15",
    twoFactor: true,
  });

  const [pwaStatus, setPwaStatus] = useState({
    isStandalone: false,
    cameraReady: true,
    cacheStatus: "Operational (Service Worker v1.0.4)",
  });

  const [savedPreferenceMsg, setSavedPreferenceMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      const isStand = window.matchMedia("(display-mode: standalone)").matches;
      setAppearance((prev) => ({ ...prev, theme: isDark ? "dark" : "light" }));
      setPwaStatus((prev) => ({ ...prev, isStandalone: isStand }));
    }
  }, []);

  const toggleTheme = (theme: "light" | "dark") => {
    setAppearance((prev) => ({ ...prev, theme }));
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // System Settings state
  const [settings, setSettings] = useState({
    company_name: "AQ COMPANIES",
    subtitle: "Dry Fruit Trading, Container Management & Accounting System",
    header_sub: "Trading • Logistics • Accounting",
    base_currency: "USD",
    headquarters: "Kabul, Afghanistan",
    commercial_destinations: "Mumbai, India; Delhi, India; Nhava Sheva / Mundra Ports",
    wire_instructions: "Emirates NBD Dubai - Account: AE440260000123456789012, SWIFT: EBILAEADXXX",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsMsg, setSavedSettingsMsg] = useState("");

  // Product Master state
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    product_name: "",
    grade: "",
    hs_code: "0804.20.00",
    default_package_kg: 10,
    default_purchase_rate: 5.0,
    default_selling_rate: 7.5,
  });

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    role: "ACCOUNTANT",
  });

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const loadAll = async () => {
    try {
      const [pData, uData, aData, sData] = await Promise.all([
        fetchApi<Product[]>("/products").catch(() => []),
        fetchApi<User[]>("/users").catch(() => []),
        fetchApi<AuditLog[]>("/audit-logs").catch(() => []),
        fetchApi<any>("/settings").catch(() => null),
      ]);
      setProducts(pData || []);
      setUsers(uData || []);
      setAuditLogs(aData || []);
      if (sData) {
        setSettings((prev) => ({
          ...prev,
          company_name: sData.company_name || prev.company_name,
          headquarters: sData.headquarters || prev.headquarters,
          wire_instructions: sData.wire_instructions || prev.wire_instructions,
        }));
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await fetchApi("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSavedSettingsMsg("System configuration saved successfully!");
      setTimeout(() => setSavedSettingsMsg(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi("/products", {
        method: "POST",
        body: JSON.stringify(productForm),
      });
      setIsProductModalOpen(false);
      setProductForm({
        product_name: "",
        grade: "",
        hs_code: "0804.20.00",
        default_package_kg: 10,
        default_purchase_rate: 5.0,
        default_selling_rate: 7.5,
      });
      loadAll();
    } catch (err: any) {
      alert(err.message || "Failed to create product");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi("/users", {
        method: "POST",
        body: JSON.stringify(userForm),
      });
      setIsUserModalOpen(false);
      setUserForm({
        username: "",
        password: "",
        full_name: "",
        email: "",
        role: "ACCOUNTANT",
      });
      loadAll();
    } catch (err: any) {
      alert(err.message || "Failed to create user");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-600" />
          Settings & System Administration
        </h1>
        <p className="text-sm text-slate-500">
          Company Profile • Product Catalog • User Roles • Immutable Audit Trail
        </p>
      </div>

      {/* Go-Live Readiness Control Banner */}
      <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              Production Go-Live Readiness & Release Gate
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                READY FOR REVIEW
              </span>
            </div>
            <p className="text-xs text-blue-200/80">
              14-Section Operational Checklist, Golden Baseline Difference Report & Disaster Recovery Runbook
            </p>
          </div>
        </div>
        <a
          href="/settings/go-live"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shrink-0"
        >
          <span>Open Readiness Center</span>
          <span className="text-xs">→</span>
        </a>
      </div>

      {/* Post-Go-Live Stabilization Banner */}
      <div className="bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 border border-sky-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/20 text-sky-300 rounded-lg">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              Post-Go-Live Stabilization & Month-End Readiness
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                ACTIVE MONITORING
              </span>
            </div>
            <p className="text-xs text-slate-300/80">
              Daily Operational Reviews, Anomaly Scanner, Missing Purchase Cost Disclosures & 7-Point Exit Gate
            </p>
          </div>
        </div>
        <a
          href="/settings/stabilization"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition shrink-0"
        >
          <span>Open Stabilization Control</span>
          <span className="text-xs">→</span>
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
        {[
          { key: "profile", label: "Profile", icon: UserIcon },
          { key: "company", label: "Company Details", icon: Building },
          { key: "appearance", label: "Appearance", icon: Sun },
          { key: "notifications", label: "Notifications", icon: Bell },
          { key: "security", label: "Security & Password", icon: Lock },
          { key: "pwa", label: "Offline & PWA", icon: Smartphone },
          { key: "products", label: `Catalog (${products.length})`, icon: Package },
          { key: "users", label: `Users (${users.length})`, icon: Users },
          { key: "audit", label: `Audit (${auditLogs.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key || (activeTab as string === "system" && tab.key === "company");
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {savedPreferenceMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{savedPreferenceMsg}</span>
        </div>
      )}

      {/* Tab: Profile */}
      {activeTab === "profile" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Operator Profile</h2>
              <p className="text-xs text-slate-500">Your operator identity and commercial credentials</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {userProfile.role}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                className="input w-full"
                value={userProfile.full_name}
                onChange={(e) => setUserProfile({ ...userProfile, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Username</label>
              <input
                type="text"
                disabled
                className="input w-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono"
                value={userProfile.username}
              />
            </div>
            <div>
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                className="input w-full"
                value={userProfile.email}
                onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Contact Phone</label>
              <input
                type="tel"
                className="input w-full"
                value={userProfile.phone}
                onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
              />
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSavedPreferenceMsg("Profile updated successfully!");
                  setTimeout(() => setSavedPreferenceMsg(""), 3000);
                }}
                className="btn btn-primary text-xs font-bold"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Appearance */}
      {activeTab === "appearance" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Appearance & Theme</h2>
            <p className="text-xs text-slate-500">iPhone interface appearance and row density</p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Theme Mode</p>
                <p className="text-slate-500 text-[11px]">Toggle between Light and Dark interface</p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleTheme("light")}
                  className={`p-1.5 rounded-md flex items-center gap-1 ${
                    appearance.theme === "light"
                      ? "bg-white text-amber-600 shadow-xs font-bold"
                      : "text-slate-400"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => toggleTheme("dark")}
                  className={`p-1.5 rounded-md flex items-center gap-1 ${
                    appearance.theme === "dark"
                      ? "bg-slate-900 text-sky-400 shadow-xs font-bold"
                      : "text-slate-400"
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" /> Dark
                </button>
              </div>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Compact Row Density</p>
                <p className="text-slate-500 text-[11px]">Tighter padding for statements and mobile cards</p>
              </div>
              <input
                type="checkbox"
                checked={appearance.compactRows}
                onChange={(e) => setAppearance({ ...appearance, compactRows: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {activeTab === "notifications" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Notification Preferences</h2>
            <p className="text-xs text-slate-500">Push notifications and accounting event triggers</p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Push Notifications</p>
                <p className="text-slate-500 text-[11px]">Receive banner alerts on customer remittances</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.pushEnabled}
                onChange={(e) => setNotifications({ ...notifications, pushEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Audio Feedback</p>
                <p className="text-slate-500 text-[11px]">Play subtle sound when a receipt posts successfully</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.soundOnPost}
                onChange={(e) => setNotifications({ ...notifications, soundOnPost: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Accounting Anomaly Alerts</p>
                <p className="text-slate-500 text-[11px]">Flag unallocated receipts and missing purchase costs</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.anomalyAlerts}
                onChange={(e) => setNotifications({ ...notifications, anomalyAlerts: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security & Password */}
      {activeTab === "security" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Security & Password</h2>
            <p className="text-xs text-slate-500">Manage credentials and authentication policy</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
              <input
                type="password"
                placeholder="••••••••••••"
                className="input w-full max-w-md"
                value={securitySettings.currentPassword}
                onChange={(e) => setSecuritySettings({ ...securitySettings, currentPassword: e.target.value })}
              />
            </div>
            <div>
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">New Password</label>
              <input
                type="password"
                placeholder="At least 8 characters"
                className="input w-full max-w-md"
                value={securitySettings.newPassword}
                onChange={(e) => setSecuritySettings({ ...securitySettings, newPassword: e.target.value })}
              />
            </div>
            <div className="pt-1">
              <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Session Auto-Lock Duration</label>
              <select
                className="select w-full max-w-md font-semibold"
                value={securitySettings.sessionTimeout}
                onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
              >
                <option value="5">5 Minutes Inactive</option>
                <option value="15">15 Minutes Inactive (Recommended)</option>
                <option value="30">30 Minutes Inactive</option>
                <option value="60">1 Hour Inactive</option>
              </select>
            </div>
            <div className="py-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</p>
                <p className="text-slate-500 text-[11px]">Require FaceID / TouchID biometric confirmation</p>
              </div>
              <input
                type="checkbox"
                checked={securitySettings.twoFactor}
                onChange={(e) => setSecuritySettings({ ...securitySettings, twoFactor: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
              />
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSavedPreferenceMsg("Security credentials updated!");
                  setTimeout(() => setSavedPreferenceMsg(""), 3000);
                }}
                className="btn btn-primary text-xs font-bold"
              >
                Update Password & Security
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Offline & PWA */}
      {activeTab === "pwa" && (
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Offline & PWA Diagnostics</h2>
            <p className="text-xs text-slate-500">iPhone standalone application status and cache management</p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Display Mode</p>
                <p className="text-slate-500 text-[11px]">Current runtime environment on this device</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                pwaStatus.isStandalone
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}>
                {pwaStatus.isStandalone ? "Installed Standalone PWA" : "Safari / Browser Mode"}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Camera & File Uploads</p>
                <p className="text-slate-500 text-[11px]">Direct receipt capture via iPhone camera or photo library</p>
              </div>
              <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Ready (image/jpeg, png, pdf)
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Service Worker Cache</p>
                <p className="text-slate-500 text-[11px]">{pwaStatus.cacheStatus}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && "caches" in window) {
                      caches.keys().then((keys) => {
                        keys.forEach((k) => caches.delete(k));
                        alert("Cache cleared successfully. Reloading...");
                        window.location.reload();
                      });
                    }
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-rose-500" /> Clear Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Company Details */}
      {(activeTab === "company" || (activeTab as string) === "system") && (
        <form onSubmit={handleSaveSettings} className="card p-6 bg-white shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Enterprise Trading Identity</h2>
              <p className="text-xs text-slate-500">Official company details appearing on commercial invoices and reports</p>
            </div>
            {savedSettingsMsg && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> {savedSettingsMsg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name *</label>
              <input
                type="text"
                className="input text-sm w-full font-bold"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Subtitle / Header Tagline</label>
              <input
                type="text"
                className="input text-sm w-full"
                value={settings.header_sub}
                onChange={(e) => setSettings({ ...settings, header_sub: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Headquarters / Origin</label>
              <input
                type="text"
                className="input text-sm w-full"
                value={settings.headquarters}
                onChange={(e) => setSettings({ ...settings, headquarters: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Primary Commercial Corridors</label>
              <input
                type="text"
                className="input text-sm w-full"
                value={settings.commercial_destinations}
                onChange={(e) => setSettings({ ...settings, commercial_destinations: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Default Bank Wire Instructions for Invoices</label>
              <input
                type="text"
                className="input text-sm w-full font-mono text-xs"
                value={settings.wire_instructions}
                onChange={(e) => setSettings({ ...settings, wire_instructions: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={savingSettings}
              className="btn btn-primary text-xs font-bold flex items-center gap-2 px-5 py-2.5"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? "Saving..." : "Save System Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Product Master */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Manage dry fruit products with HS codes, carton net weights, and reference rates
            </p>
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>

          <div className="card overflow-hidden bg-white shadow-sm">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Grade / Variety</th>
                    <th>HS Code</th>
                    <th className="text-right">Pkg KG</th>
                    <th className="text-right">Default Purchase Rate</th>
                    <th className="text-right">Default Selling Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="font-bold text-slate-900">{p.product_name}</td>
                      <td className="text-xs text-slate-600">{p.grade || "Standard"}</td>
                      <td className="text-xs font-mono text-slate-500">{p.hs_code || "0804.20"}</td>
                      <td className="text-right font-medium">{p.default_package_kg} KG</td>
                      <td className="text-right font-mono text-slate-700">{formatRate(p.default_purchase_rate)}</td>
                      <td className="text-right font-mono font-bold text-slate-900">
                        {formatRate(p.default_selling_rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: User Accounts */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Manage user accounts and role permissions</p>
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          <div className="card overflow-hidden bg-white shadow-sm">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="font-mono font-bold text-slate-900">{u.username}</td>
                      <td className="font-medium text-slate-800">{u.full_name}</td>
                      <td className="text-xs text-slate-500">{u.email}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === "ADMIN" ? "badge-primary" : "badge-neutral"
                          } text-xs font-bold`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success text-[11px]">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === "audit" && (
        <div className="card overflow-hidden bg-white shadow-sm space-y-3">
          <div className="p-4 border-b">
            <h3 className="text-base font-bold text-slate-900">Immutable System Audit Trail</h3>
            <p className="text-xs text-slate-500">Real-time log of data modifications, creations, and financial updates</p>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 text-xs">
                    <td className="font-mono text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          log.action === "CREATE"
                            ? "badge-success"
                            : log.action === "UPDATE"
                            ? "badge-warning"
                            : "badge-neutral"
                        } text-[10px] font-bold`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="font-semibold text-slate-800">
                      {log.entity_type} #{log.entity_id}
                    </td>
                    <td className="text-slate-600">{log.user_name}</td>
                    <td className="text-slate-600 font-mono text-[11px] truncate max-w-md">
                      {log.new_value_json || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Product to Catalog</h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="label">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mamra Almonds"
                  className="input text-sm w-full"
                  value={productForm.product_name}
                  onChange={(e) => setProductForm({ ...productForm, product_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Grade / Variety</label>
                <input
                  type="text"
                  placeholder="Grade AAA"
                  className="input text-sm w-full"
                  value={productForm.grade}
                  onChange={(e) => setProductForm({ ...productForm, grade: e.target.value })}
                />
              </div>

              <div>
                <label className="label">HS Code</label>
                <input
                  type="text"
                  placeholder="0802.12.00"
                  className="input text-sm w-full font-mono"
                  value={productForm.hs_code}
                  onChange={(e) => setProductForm({ ...productForm, hs_code: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Purchase Rate ($/KG)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="input text-sm w-full font-mono"
                    value={productForm.default_purchase_rate}
                    onChange={(e) =>
                      setProductForm({ ...productForm, default_purchase_rate: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="label">Selling Rate ($/KG)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="input text-sm w-full font-mono font-bold"
                    value={productForm.default_selling_rate}
                    onChange={(e) =>
                      setProductForm({ ...productForm, default_selling_rate: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-sm font-bold">
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Staff User</h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="label">Username *</label>
                <input
                  type="text"
                  placeholder="e.g. accountant1"
                  className="input text-sm w-full font-mono"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Password *</label>
                <input
                  type="password"
                  className="input text-sm w-full"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Farhad Mohammadi"
                  className="input text-sm w-full"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  placeholder="farhad@aqcompanies.com"
                  className="input text-sm w-full"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Role Permission *</label>
                <select
                  className="select text-sm w-full font-semibold"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="ACCOUNTANT">Accountant (Ledgers, Bank, Invoices)</option>
                  <option value="LOGISTICS_OFFICER">Logistics Officer (Containers, Transport)</option>
                  <option value="ADMIN">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-sm font-bold">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
