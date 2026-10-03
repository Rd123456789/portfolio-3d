"use client";

import React, { useState, useEffect } from "react";
import {
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  ArrowUpRight,
  List,
  X,
} from "@phosphor-icons/react";
import { PERSONAL_INFO } from "@/lib/projects";
import {
  setSoundActive,
  playRadarPing,
  playIndustrialClick,
} from "@/lib/sound";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    setSoundActive(nextState);
    if (nextState) {
      playRadarPing();
    }
  };

  const scrollTo = (id: string) => {
    playIndustrialClick();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 h-[56px] flex items-center transition-all duration-300 border-b ${
        scrolled
          ? "bg-[#1A1A1A]/90 backdrop-blur-xl border-dotted border-[#3D3D3D]"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand mark */}
        <div className="flex items-center gap-3">
          <span className="sq" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#F0F0F0] flex items-center gap-2 whitespace-nowrap">
            {PERSONAL_INFO.name}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono tracking-[0.08em] bg-[#3A7A65]/15 text-[#72A899] border border-dotted border-[#3A7A65]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3A7A65] animate-pulse" />
              OPEN TO WORK
            </span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollTo("section-hero")}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#D6D6D6] hover:text-[#FE6E00] transition-colors cursor-pointer"
          >
            // 01. ABOUT
          </button>
          <button
            onClick={() => scrollTo("section-about")}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#D6D6D6] hover:text-[#FE6E00] transition-colors cursor-pointer"
          >
            // 02. EXPERIENCE
          </button>
          <button
            onClick={() => scrollTo("section-works")}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#D6D6D6] hover:text-[#FE6E00] transition-colors cursor-pointer"
          >
            // 03. PROJECTS
          </button>
          <button
            onClick={() => scrollTo("section-contact")}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#D6D6D6] hover:text-[#FE6E00] transition-colors cursor-pointer"
          >
            // 04. CONTACT
          </button>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Audio Toggle */}
          <button
            onClick={toggleSound}
            className="btn-ghost btn-sm !py-2 !px-2.5 sm:!px-3"
            title="Toggle Audio Feedback"
          >
            {soundEnabled ? (
              <SpeakerSimpleHigh size={14} weight="thin" className="text-[#FE6E00]" />
            ) : (
              <SpeakerSimpleSlash size={14} weight="thin" className="text-[#8A8A8A]" />
            )}
            <span className="hidden sm:inline">
              {soundEnabled ? "AUDIO ON" : "MUTED"}
            </span>
          </button>

          {/* Primary Recruiter CTA */}
          <button
            onClick={() => scrollTo("section-contact")}
            className="btn-primary !py-2 !px-3 sm:!px-4 !text-[10px] sm:!text-[11px] font-mono tracking-[0.06em] whitespace-nowrap"
          >
            <span>HIRE ME</span>
            <ArrowUpRight size={13} weight="thin" />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => {
              playIndustrialClick();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className="md:hidden p-2 border border-dotted border-[#3D3D3D] text-[#D6D6D6] hover:text-[#FE6E00] hover:border-[#FE6E00] transition-colors"
            title="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? (
              <X size={16} weight="thin" />
            ) : (
              <List size={16} weight="thin" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[56px] left-0 right-0 bg-[#1A1A1A]/95 backdrop-blur-2xl border-b border-dotted border-[#3D3D3D] p-6 space-y-4 z-50">
          <div className="eyebrow pb-2 border-b border-dotted border-[#3D3D3D]">
            <span className="sq" />
            <span>PORTFOLIO DIRECTORY</span>
          </div>
          <div className="flex flex-col space-y-3 font-mono text-xs">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollTo("section-hero");
              }}
              className="text-left py-2 px-3 border border-dotted border-[#3D3D3D] hover:border-[#FE6E00] hover:text-[#FE6E00] text-[#D6D6D6] transition-colors"
            >
              // 01. ABOUT & PROFILE
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollTo("section-about");
              }}
              className="text-left py-2 px-3 border border-dotted border-[#3D3D3D] hover:border-[#FE6E00] hover:text-[#FE6E00] text-[#D6D6D6] transition-colors"
            >
              // 02. EXPERIENCE & SKILLS
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollTo("section-works");
              }}
              className="text-left py-2 px-3 border border-dotted border-[#3D3D3D] hover:border-[#FE6E00] hover:text-[#FE6E00] text-[#D6D6D6] transition-colors"
            >
              // 03. FEATURED PROJECTS
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                scrollTo("section-contact");
              }}
              className="text-left py-2 px-3 border border-dotted border-[#3D3D3D] hover:border-[#FE6E00] hover:text-[#FE6E00] text-[#D6D6D6] transition-colors"
            >
              // 04. GET IN TOUCH / HIRE ME
            </button>
          </div>
          <div className="pt-2 border-t border-dotted border-[#3D3D3D] flex items-center justify-between text-[10px] font-mono text-[#8A8A8A]">
            <span>SOFTWARE ENGINEER // RAJDIP PARMAR</span>
            <span className="text-[#3A7A65]">AVAILABLE FOR HIRE</span>
          </div>
        </div>
      )}
    </header>
  );
}
