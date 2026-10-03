"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Lock,
  EnvelopeSimple,
  User,
  Clock,
  Trash,
  CheckCircle,
  ArrowLeft,
  ArrowClockwise,
  ShieldCheck,
  SignOut,
  Copy,
  PaperPlaneTilt,
  Broadcast,
  Eye,
} from "@phosphor-icons/react";
import { playIndustrialClick, playRadarPing, playTelemetryDispatch } from "@/lib/sound";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  source?: string;
  ip?: string;
  userAgent?: string;
  isRead?: boolean;
  createdAt: string;
}

const API_BASE = "https://oxidised-jewllery.onrender.com/api/v1/portfolio";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("rajdipparmar221@gmail.com");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check saved session
  useEffect(() => {
    const savedToken = localStorage.getItem("portfolio_admin_token");
    if (savedToken) {
      setToken(savedToken);
      fetchInquiries(savedToken);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);
    playIndustrialClick();

    try {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error?.message || "Invalid credentials");
      }

      playRadarPing();
      const authToken = data.data.token;
      localStorage.setItem("portfolio_admin_token", authToken);
      setToken(authToken);
      setPasswordInput("");
      fetchInquiries(authToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    playIndustrialClick();
    localStorage.removeItem("portfolio_admin_token");
    setToken(null);
    setInquiries([]);
  };

  const fetchInquiries = async (authToken: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/inquiries`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        handleLogout();
        throw new Error("Session expired. Please sign in again.");
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load inquiries");
      }

      setInquiries(data.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load inquiries";
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    playIndustrialClick();
    try {
      const res = await fetch(`${API_BASE}/admin/inquiries/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setInquiries((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
        );
        setActionSuccess("Inquiry marked as read.");
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch {
      // silently handle
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to permanently delete this inquiry?")) return;
    playIndustrialClick();
    try {
      const res = await fetch(`${API_BASE}/admin/inquiries/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setInquiries((prev) => prev.filter((item) => item.id !== id));
        setActionSuccess("Inquiry permanently deleted.");
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } catch {
      // silently handle
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    playIndustrialClick();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const unreadCount = inquiries.filter((i) => !i.isRead).length;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#D6D6D6] font-sans selection:bg-[#FE6E00] selection:text-[#1A1A1A]">
      {/* Top Bar */}
      <header className="border-b border-dotted border-[#3D3D3D] bg-[#1A1A1A]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => playIndustrialClick()}
              className="p-1.5 border border-dotted border-[#3D3D3D] hover:border-[#FE6E00] text-[#8A8A8A] hover:text-[#FE6E00] transition-colors"
              title="Return to Portfolio"
            >
              <ArrowLeft size={16} weight="thin" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="sq" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#F0F0F0]">
                TELEMETRY & INQUIRY OPS // ADMIN TERMINAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono tracking-[0.08em] bg-[#3A7A65]/15 text-[#72A899] border border-dotted border-[#3A7A65]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3A7A65] animate-pulse" />
              PORTFOLIO BACKEND ONLINE
            </span>
            {token && (
              <button
                onClick={handleLogout}
                className="btn-ghost !py-1.5 !px-3 !text-[10px] font-mono tracking-[0.08em] text-[#D6D6D6]"
              >
                <SignOut size={13} weight="thin" />
                <span>SIGN OUT</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {!token ? (
          /* LOGIN PANEL */
          <div className="max-w-md mx-auto mt-8 sm:mt-16 bg-[#242424] border border-dotted border-[#3D3D3D] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dotted border-[#3D3D3D] pb-4 mb-6">
              <div className="eyebrow">
                <span className="sq" />
                <span>RESTRICTED ACCESS</span>
              </div>
              <span className="meta-label text-[#FE6E00] flex items-center gap-1">
                <Lock size={12} weight="thin" />
                <span>AUTHORIZATION REQUIRED</span>
              </span>
            </div>

            <h1 className="font-display text-2xl text-[#F0F0F0] mb-2">
              Recruiter Inquiries <em>Terminal</em>
            </h1>
            <p className="text-xs text-[#8A8A8A] font-sans mb-6">
              Enter admin credentials to review incoming technical interviews, role discussions, and recruiter messages.
            </p>

            {authError && (
              <div className="mb-5 p-3 bg-[#1A1A1A] border border-dotted border-[#FE6E00] text-[#FE6E00] font-mono text-xs">
                ⚠ {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="meta-label block mb-1">ADMIN IDENTIFIER / EMAIL</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-b border-dotted border-[#3D3D3D] text-[#F0F0F0] placeholder-[#8A8A8A]/50 font-mono text-xs focus:border-[#FE6E00] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="meta-label block mb-1">SECURITY PASSWORD</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-transparent border-b border-dotted border-[#3D3D3D] text-[#F0F0F0] placeholder-[#8A8A8A]/50 font-mono text-xs focus:border-[#FE6E00] focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="btn-primary w-full justify-center !py-2.5 !px-4 !text-[11px] font-mono tracking-[0.08em] mt-6 disabled:opacity-50"
              >
                <span>{isAuthenticating ? "AUTHENTICATING CREDENTIALS..." : "ACCESS TERMINAL"}</span>
                <ShieldCheck size={14} weight="thin" />
              </button>
            </form>
          </div>
        ) : (
          /* INQUIRIES DASHBOARD */
          <div className="space-y-6">
            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#242424] border border-dotted border-[#3D3D3D] p-5">
                <span className="meta-label text-[#8A8A8A] block mb-1">TOTAL INQUIRIES RECORDED</span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-3xl font-bold text-[#F0F0F0]">{inquiries.length}</span>
                  <Broadcast size={20} weight="thin" className="text-[#3A7A65]" />
                </div>
              </div>

              <div className="bg-[#242424] border border-dotted border-[#3D3D3D] p-5">
                <span className="meta-label text-[#8A8A8A] block mb-1">UNREAD / ACTIONABLE</span>
                <div className="flex items-baseline justify-between">
                  <span className={`font-mono text-3xl font-bold ${unreadCount > 0 ? "text-[#FE6E00]" : "text-[#72A899]"}`}>
                    {unreadCount}
                  </span>
                  <span className="meta-label text-[#FE6E00]">PRIORITY ATTENTION</span>
                </div>
              </div>

              <div className="bg-[#242424] border border-dotted border-[#3D3D3D] p-5 flex flex-col justify-between">
                <span className="meta-label text-[#8A8A8A] block mb-1">OPS FEED REFRESH</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8A8A8A]">
                    {isLoading ? "SYNCING FEED..." : "LIVE SYNC READY"}
                  </span>
                  <button
                    onClick={() => token && fetchInquiries(token)}
                    disabled={isLoading}
                    className="btn-ghost !py-1 !px-2.5 !text-[10px] font-mono text-[#D6D6D6] hover:text-[#FE6E00]"
                  >
                    <ArrowClockwise size={12} weight="thin" className={isLoading ? "animate-spin" : ""} />
                    <span>REFRESH</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Notification alert */}
            {actionSuccess && (
              <div className="p-3 bg-[#1A1A1A] border border-dotted border-[#3A7A65] text-[#72A899] font-mono text-xs">
                ✓ {actionSuccess}
              </div>
            )}
            {fetchError && (
              <div className="p-3 bg-[#1A1A1A] border border-dotted border-[#FE6E00] text-[#FE6E00] font-mono text-xs">
                ⚠ {fetchError}
              </div>
            )}

            {/* Inquiries Stream */}
            <div className="bg-[#242424] border border-dotted border-[#3D3D3D] p-5 sm:p-8 shadow-2xl">
              <div className="flex items-center justify-between border-b border-dotted border-[#3D3D3D] pb-4 mb-6">
                <div className="eyebrow">
                  <span className="sq" />
                  <span>TRANSMISSION ARCHIVE // RECRUITER CONTACT STREAM</span>
                </div>
                <span className="meta-label text-[#8A8A8A]">SORT: NEWEST FIRST</span>
              </div>

              {inquiries.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <EnvelopeSimple size={36} weight="thin" className="text-[#3D3D3D] mx-auto" />
                  <p className="font-mono text-xs text-[#8A8A8A]">
                    NO RECRUITER INQUIRIES REGISTERED IN DATABASE YET.
                  </p>
                  <p className="text-xs text-[#8A8A8A]/70 max-w-sm mx-auto">
                    When recruiters submit messages from the portfolio contact form, they will appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {inquiries.map((inquiry) => {
                    const dateFormatted = new Date(inquiry.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={inquiry.id}
                        className={`p-4 sm:p-5 border border-dotted transition-colors ${
                          inquiry.isRead
                            ? "border-[#3D3D3D] bg-[#1A1A1A]/50"
                            : "border-[#FE6E00]/60 bg-[#1A1A1A]/90"
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dotted border-[#3D3D3D] pb-3 mb-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-mono text-sm font-semibold text-[#F0F0F0] flex items-center gap-1.5">
                              <User size={14} weight="thin" className="text-[#FE6E00]" />
                              {inquiry.name}
                            </span>
                            {!inquiry.isRead ? (
                              <span className="px-1.5 py-0.5 bg-[#FE6E00]/15 text-[#FE6E00] border border-dotted border-[#FE6E00]/40 font-mono text-[9px] uppercase tracking-wider">
                                NEW / UNREAD
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-[#3A7A65]/15 text-[#72A899] border border-dotted border-[#3A7A65]/40 font-mono text-[9px] uppercase tracking-wider">
                                REVIEWED
                              </span>
                            )}
                            <span className="meta-label text-[9px] text-[#8A8A8A]">
                              SOURCE: {inquiry.source || "portfolio-3d"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-mono text-[#8A8A8A]">
                            <Clock size={12} weight="thin" />
                            <span>{dateFormatted}</span>
                          </div>
                        </div>

                        {/* Email Row */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="meta-label text-[9px] text-[#8A8A8A]">EMAIL:</span>
                          <a
                            href={`mailto:${inquiry.email}?subject=Re:%20Portfolio%20Inquiry%20-%20Rajdip%20Parmar`}
                            className="font-mono text-xs text-[#72A899] hover:text-[#FE6E00] transition-colors underline decoration-dotted"
                          >
                            {inquiry.email}
                          </a>
                          <button
                            onClick={() => copyToClipboard(inquiry.email, inquiry.id)}
                            className="text-[#8A8A8A] hover:text-[#F0F0F0] transition-colors p-1"
                            title="Copy email to clipboard"
                          >
                            <Copy size={12} weight="thin" />
                          </button>
                          {copiedId === inquiry.id && (
                            <span className="text-[9px] font-mono text-[#3A7A65]">COPIED</span>
                          )}
                        </div>

                        {/* Message Box */}
                        <div className="p-3 bg-[#242424] border border-dotted border-[#3D3D3D] text-[#D6D6D6] font-sans text-xs leading-relaxed whitespace-pre-wrap mb-4">
                          {inquiry.message}
                        </div>

                        {/* IP & Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <div className="text-[9px] font-mono text-[#8A8A8A]/70 flex items-center gap-3">
                            {inquiry.ip && <span>IP: {inquiry.ip}</span>}
                            <span>ID: {inquiry.id.slice(-6)}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {!inquiry.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(inquiry.id)}
                                className="btn-ghost !py-1 !px-2.5 !text-[10px] font-mono text-[#72A899] hover:border-[#3A7A65]"
                              >
                                <CheckCircle size={12} weight="thin" />
                                <span>MARK READ</span>
                              </button>
                            )}
                            <a
                              href={`mailto:${inquiry.email}?subject=Re:%20Portfolio%20Inquiry%20-%20Rajdip%20Parmar`}
                              onClick={() => playIndustrialClick()}
                              className="btn-primary !py-1 !px-2.5 !text-[10px] font-mono"
                            >
                              <PaperPlaneTilt size={12} weight="thin" />
                              <span>REPLY EMAIL</span>
                            </a>
                            <button
                              onClick={() => handleDelete(inquiry.id)}
                              className="btn-ghost !py-1 !px-2 !text-[10px] font-mono text-[#8A8A8A] hover:text-[#FE6E00] hover:border-[#FE6E00]"
                              title="Delete inquiry"
                            >
                              <Trash size={12} weight="thin" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
