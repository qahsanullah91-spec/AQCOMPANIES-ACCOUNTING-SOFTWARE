"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Ship,
  Boxes,
  ShoppingBag,
  Receipt,
  Users,
  Building2,
  Truck,
  Landmark,
  Wallet,
  CreditCard,
  X,
} from "lucide-react";

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickActionModal({ isOpen, onClose }: QuickActionModalProps) {
  if (!isOpen) return null;

  const quickActions = [
    { label: "New Shipment", href: "/shipments?action=new", icon: Ship, color: "bg-sky-500 text-white" },
    { label: "New Stock", href: "/new-stock?action=new", icon: Boxes, color: "bg-emerald-500 text-white" },
    { label: "New Purchase", href: "/purchases?action=new", icon: ShoppingBag, color: "bg-indigo-500 text-white" },
    { label: "New Invoice", href: "/invoices?action=new", icon: Receipt, color: "bg-blue-600 text-white" },
    { label: "New Customer", href: "/customers?action=new", icon: Users, color: "bg-purple-500 text-white" },
    { label: "New Supplier", href: "/suppliers?action=new", icon: Building2, color: "bg-amber-600 text-white" },
    { label: "Customer Receipt", href: "/payments?action=receipt", icon: CreditCard, color: "bg-teal-600 text-white" },
    { label: "Supplier Payment", href: "/bank-ledger?action=supplier_pay", icon: Landmark, color: "bg-rose-500 text-white" },
    { label: "Transport Payment", href: "/transport?action=pay", icon: Truck, color: "bg-orange-500 text-white" },
    { label: "Expense", href: "/expenses?action=new", icon: Wallet, color: "bg-red-500 text-white" },
    { label: "Bank Transaction", href: "/bank-ledger?action=new", icon: Landmark, color: "bg-slate-700 text-white" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Create New Record</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                onClick={onClose}
                className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color} shadow-xs`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
