"use client";

import React, { useState } from "react";
import {
  Project,
  PROJECTS,
  PERSONAL_INFO,
  EXPERIENCES,
  EDUCATION,
  SKILL_CATEGORIES,
  LANGUAGES,
} from "@/lib/projects";
import { playIndustrialClick, playRadarPing, playTelemetryDispatch } from "@/lib/sound";
import {
  ArrowDown,
  ArrowUpRight,
  GlobeHemisphereWest,
  MapPin,
  Phone,
  EnvelopeSimple,
  Briefcase,
  GraduationCap,
  PaperPlaneTilt,
  Check,
  Compass,
  Cpu,
  Buildings,
  GitBranch,
  GithubLogo,
  LinkedinLogo,
  LockSimple,
} from "@phosphor-icons/react";

interface OverlaySectionsProps {
  onSelectProject: (project: Project) => void;
  activeProject?: Project | null;
  onHoverProject?: (project: Project) => void;
}

export default function OverlaySections({
  onSelectProject,
  activeProject,
  onHoverProject,
}: OverlaySectionsProps) {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.message.trim().length < 20) {
      setFormError("Role details must contain at least 20 characters before transmission.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    playTelemetryDispatch();

    try {
      const response = await fetch("https://oxidised-jewllery.onrender.com/api/v1/portfolio/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to transmit inquiry");
      }

      setFormSubmitted(true);
      setFormData({ name: "", email: "", message: "" });
      setTimeout(() => {
        setFormSubmitted(false);
      }, 5000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Transmission failed. Please reach out via email directly.";
      setFormError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="portfolio-scroll-container"
      className="relative z-10 w-full pointer-events-none"
    >
      {/* =========================================================================
          SECTION 01: HERO (ABOUT & PROFILE) - MAX 1200PX CONTAINER
      ========================================================================= */}
      <section
        id="section-hero"
        className="min-h-screen flex flex-col justify-between px-3 sm:px-6 lg:px-8 pt-16 pb-8 md:py-28 max-w-[1200px] mx-auto pointer-events-none border-b border-dotted border-[#3D3D3D]"
      >
        <div className="w-full max-w-2xl mt-2 sm:mt-8 bg-[#242424]/92 backdrop-blur-md border border-dotted border-[#3D3D3D] p-5 sm:p-8 pointer-events-auto shadow-2xl">
          {/* Eyebrow */}
          <div className="eyebrow mb-3 sm:mb-6">
            <span className="sq" />
            <span>FULL-STACK & MOBILE SOFTWARE ENGINEER</span>
          </div>

          {/* Lora Headline with single italic accent */}
          <h1 className="font-display text-2xl sm:text-5xl lg:text-6xl text-[#F0F0F0] leading-[1.12] sm:leading-[1.08] tracking-[-0.02em] mb-3 sm:mb-6">
            Engineering scalable <em>GIS</em> & cross-platform applications.
          </h1>

          {/* Description (Geist 16px) */}
          <p className="text-[#D6D6D6] text-xs sm:text-base leading-relaxed max-w-xl font-sans mb-4 sm:mb-8">
            {PERSONAL_INFO.bio}
          </p>

          {/* Anchor Metric Tiles (§6.4.A Anchor Variant - filled bg-ds + dotted border) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-dotted border-[#3D3D3D] bg-[#1A1A1A]/60 mb-4 sm:mb-8">
            {PERSONAL_INFO.stats.map((stat, i) => (
              <div
                key={i}
                className="p-2.5 sm:p-3.5 border-b sm:border-b-0 border-r [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:last:border-r-0 border-dotted border-[#3D3D3D]"
              >
                <div className="font-mono text-sm sm:text-base font-bold text-[#F0F0F0] whitespace-nowrap tracking-tight">
                  {stat.value}
                </div>
                <div className="meta-label mt-1 text-[8px] sm:text-[9px] text-[#8A8A8A] uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Recruiter Contact & Location Chips */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] bg-[#1A1A1A] text-[#D6D6D6] border border-dotted border-[#3D3D3D]">
              <MapPin size={12} weight="thin" className="text-[#FE6E00]" />
              {PERSONAL_INFO.location}
            </span>
            <a
              href={`tel:${PERSONAL_INFO.phone}`}
              onClick={() => playIndustrialClick()}
              className="inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] bg-[#1A1A1A] text-[#D6D6D6] hover:text-[#3A7A65] hover:border-[#3A7A65] border border-dotted border-[#3D3D3D] transition-colors cursor-pointer"
            >
              <Phone size={12} weight="thin" className="text-[#3A7A65]" />
              {PERSONAL_INFO.phone}
            </a>
            <a
              href={`mailto:${PERSONAL_INFO.email}`}
              onClick={() => playIndustrialClick()}
              className="inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] bg-[#1A1A1A] text-[#D6D6D6] hover:text-[#FE6E00] hover:border-[#FE6E00] border border-dotted border-[#3D3D3D] transition-colors cursor-pointer"
            >
              <EnvelopeSimple size={12} weight="thin" className="text-[#FE6E00]" />
              {PERSONAL_INFO.email}
            </a>
          </div>

          {/* Direct Recruiter CTA Row */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-dotted border-[#3D3D3D]">
            <a
              href="#section-contact"
              onClick={() => playIndustrialClick()}
              className="btn-primary !py-2.5 !px-5 !text-[11px] font-mono tracking-[0.08em]"
            >
              <span>HIRE ME / GET IN TOUCH</span>
              <ArrowUpRight size={14} weight="thin" />
            </a>
            <a
              href="https://oxidised-jewllery.onrender.com/api/v1/portfolio/cv?download=true"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playIndustrialClick()}
              className="btn-ghost !py-2.5 !px-4 !text-[11px] font-mono tracking-[0.08em]"
            >
              <span>DOWNLOAD CV</span>
              <ArrowUpRight size={14} weight="thin" />
            </a>
          </div>
        </div>

        {/* Scroll signal indicator */}
        <div className="flex items-center gap-3 meta-label text-[#8A8A8A] animate-bounce pointer-events-auto pt-6">
          <ArrowDown size={14} weight="thin" className="text-[#FE6E00]" />
          <span>SCROLL TO EXPLORE WORK EXPERIENCE & PROJECTS</span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 02: CAPABILITIES MATRIX & CAREER LOG (§6.4.B HAIRLINE GRID)
      ========================================================================= */}
      <section
        id="section-about"
        className="min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-20 md:py-28 max-w-[1200px] mx-auto pointer-events-none border-b border-dotted border-[#3D3D3D]"
      >
        {/* Symmetrical High-Contrast Operations Dossier Enclosure */}
        <div className="w-full max-w-4xl mx-auto bg-[#242424]/95 backdrop-blur-md border border-dotted border-[#3D3D3D] p-6 sm:p-10 pointer-events-auto shadow-2xl">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-dotted border-[#3D3D3D] pb-4 mb-6">
            <div className="eyebrow">
              <span className="sq" />
              <span>PROFESSIONAL EXPERIENCE & TECHNICAL SKILLS</span>
            </div>
            <span className="meta-label text-[#3A7A65]">FULL-STACK & MOBILE ENGINEER</span>
          </div>

          {/* Section Title with Editorial Accent */}
          <h2 className="section-title mb-3">
            Proven impact across <em>production</em> systems.
          </h2>

          <p className="text-[#D6D6D6] text-sm sm:text-base leading-relaxed mb-8 font-sans max-w-2xl">
            Over 3+ years architecting scalable web applications, offline-first mobile architectures, and spatial asset management systems for enterprise clients and state utilities. Focused on clean code, performant frontend engineering, and measurable user impact.
          </p>

          {/* §6.4.D Row-List Variant for Career Trajectory */}
          <div className="mb-10">
            <div className="meta-label text-[#FE6E00] mb-3 flex items-center gap-2">
              <Briefcase size={14} weight="thin" />
              <span>CAREER TIMELINE & WORK EXPERIENCE</span>
            </div>

            <div className="border-t border-dotted border-[#3D3D3D]">
              {EXPERIENCES.map((exp, expIdx) => (
                <div
                  key={expIdx}
                  className="p-4 sm:p-5 border-b border-dotted border-[#3D3D3D] bg-[#1A1A1A]/40 hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                    <div>
                      <h4 className="font-display text-lg text-[#F0F0F0]">
                        {exp.role}{" "}
                        <span className="font-mono text-sm text-[#D6D6D6]">
                          @ {exp.company}
                        </span>
                      </h4>
                      <p className="meta-label text-[9px] text-[#8A8A8A] mt-0.5">
                        {exp.location}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#FE6E00] bg-[#1A1A1A] px-2 py-0.5 border border-dotted border-[#FE6E00]/30 self-start sm:self-auto">
                      [{exp.period}]
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-sm text-[#D6D6D6] font-sans mt-3">
                    {exp.description.map((desc, dIdx) => (
                      <li key={dIdx} className="flex items-start gap-2">
                        <span className="text-[#FE6E00] font-mono leading-tight">▹</span>
                        <span className="leading-relaxed">{desc}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2">
                    {exp.technologies.map((tech, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] bg-[#1A1A1A] text-[#D6D6D6] border border-dotted border-[#3D3D3D]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* §6.4.B Hairline-Grid Variant for Capabilities */}
          <div className="space-y-6 mb-10">
            <div className="meta-label text-[#FE6E00] flex items-center gap-2">
              <Cpu size={14} weight="thin" />
              <span>CORE TECHNICAL SKILLS & PROFICIENCIES</span>
            </div>

            {SKILL_CATEGORIES.map((cat, idx) => (
              <div
                key={idx}
                className="border-t border-dotted border-[#3D3D3D]"
              >
                <div className="grid grid-cols-12 gap-2 sm:gap-4 py-2.5 sm:py-3 border-b border-dotted border-[#3D3D3D] items-start">
                  <div className="col-span-5 font-mono text-[11px] sm:text-xs uppercase tracking-[0.10em] text-[#FE6E00] flex items-start gap-2 leading-relaxed">
                    <span className="sq !w-1.5 !h-1.5 mt-1 shrink-0" />
                    <span>{cat.title}</span>
                  </div>
                  <div className="col-span-7 text-right font-mono text-[9px] sm:text-[9.5px] uppercase tracking-[0.06em] text-[#D6D6D6] leading-relaxed">
                    {cat.description}
                  </div>
                </div>

                {/* Cells in Hairline Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  {cat.skills.map((skill, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-3 border-b border-r [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(4n)]:border-r-0 border-dotted border-[#3D3D3D] bg-[#1A1A1A]/30 hover:bg-[#1A1A1A] transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-[#F0F0F0] leading-snug">
                          {skill.name}
                        </div>
                        <div className="meta-label text-[#FE6E00] mt-1 text-[9px]">
                          {skill.level}
                        </div>
                      </div>
                      <div className="font-mono text-[9.5px] text-[#8A8A8A] mt-2 leading-relaxed">
                        {skill.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Education & Languages (Two-column Hairline Split) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 border border-dotted border-[#3D3D3D] bg-[#1A1A1A]/40">
            <div className="p-4 sm:p-5 border-b sm:border-b-0 sm:border-r border-dotted border-[#3D3D3D]">
              <div className="meta-label text-[#FE6E00] mb-3 flex items-center gap-2">
                <GraduationCap size={14} weight="thin" />
                <span>EDUCATION & CREDENTIALS</span>
              </div>
              {EDUCATION.map((edu, eIdx) => (
                <div key={eIdx} className="mb-3 last:mb-0">
                  <div className="font-mono text-xs font-semibold text-[#F0F0F0]">
                    {edu.degree}
                  </div>
                  <div className="font-sans text-xs text-[#D6D6D6] mt-0.5">
                    {edu.institution}
                  </div>
                  <div className="meta-label text-[9px] text-[#8A8A8A] mt-0.5">
                    {edu.period} • {edu.location}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-5">
              <div className="meta-label text-[#FE6E00] mb-3 flex items-center gap-2">
                <GlobeHemisphereWest size={14} weight="thin" />
                <span>LANGUAGES & PROFICIENCY</span>
              </div>
              <div className="space-y-2.5">
                {LANGUAGES.map((lang, lIdx) => (
                  <div key={lIdx} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#F0F0F0]">{lang.name}</span>
                    <span className="meta-label text-[9px] text-[#3A7A65] bg-[#1A1A1A] px-1.5 py-0.5 border border-dotted border-[#3A7A65]/30">
                      {lang.fluency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 03: FEATURED ENGINEERING PROJECTS // ARCHITECTURE
      ========================================================================= */}
      <section
        id="section-works"
        className="min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-20 md:py-28 max-w-[1200px] mx-auto pointer-events-none border-b border-dotted border-[#3D3D3D]"
      >
        {/* DESKTOP VIEW (Project Selection Deck on Left, 3D Interactive Model on Right) */}
        <div className="hidden md:block w-full max-w-lg bg-[#242424]/90 backdrop-blur-md border border-dotted border-[#3D3D3D] p-8 pointer-events-auto shadow-2xl">
          <div className="eyebrow mb-3">
            <span className="sq" />
            <span>FEATURED ENGINEERING PROJECTS</span>
          </div>

          <h2 className="section-title mb-3">
            Production <em>software</em> portfolio.
          </h2>

          <p className="text-[#D6D6D6] text-sm leading-relaxed mb-5 font-sans">
            Selected enterprise applications and spatial mapping platforms. Hover or click any project below to inspect its architecture, engineering highlights, and live deployment:
          </p>

          {/* Active Project Architecture Status Box */}
          <div className="p-3 bg-[#1A1A1A] border border-dotted border-[#FE6E00]/40 mb-5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[#FE6E00] mb-1.5">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FE6E00] animate-pulse" />
                <span>SELECTED: {activeProject?.title.toUpperCase() || "CSPDCL GRID GIS"}</span>
              </span>
              <span className="text-[#3A7A65]">VERIFIED PRODUCTION</span>
            </div>
            <div className="text-[#8A8A8A] text-[9px]">
              ROLE: {activeProject?.role.toUpperCase() || "LEAD MOBILE & GIS ENGINEER"} • TECH: {activeProject?.tags.slice(0, 3).join(", ").toUpperCase() || "IONIC, ANGULAR, GIS"}
            </div>
          </div>

          {/* Project Selector Buttons */}
          <div className="border-t border-dotted border-[#3D3D3D]">
            {PROJECTS.map((proj, idx) => {
              const isSelected = activeProject?.id === proj.id;
              return (
                <button
                  key={proj.id}
                  onMouseEnter={() => {
                    onHoverProject?.(proj);
                    playRadarPing();
                  }}
                  onClick={() => {
                    playIndustrialClick();
                    onSelectProject(proj);
                  }}
                  className={`w-full text-left p-3.5 border-b border-dotted border-[#3D3D3D] transition-colors flex items-center justify-between group cursor-pointer ${
                    isSelected
                      ? "bg-[#1A1A1A] border-l-2 border-l-[#FE6E00]"
                      : "hover:bg-[#1A1A1A]/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#FE6E00]">
                      {`[0${idx + 1}]`}
                    </span>
                    <div>
                      <h3
                        className={`font-display text-sm transition-colors ${
                          isSelected
                            ? "text-[#FE6E00]"
                            : "text-[#F0F0F0] group-hover:text-[#FE6E00]"
                        }`}
                      >
                        {proj.title}
                      </h3>
                      <p className="meta-label text-[9px] text-[#8A8A8A] mt-0.5">
                        {proj.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <span className="font-mono text-[9px] text-[#FE6E00] tracking-wider uppercase whitespace-nowrap hidden sm:inline">
                        INSPECT
                      </span>
                    )}
                    <div className="p-1.5 border border-dotted border-[#3D3D3D] group-hover:border-[#FE6E00] group-hover:text-[#FE6E00] transition-colors text-[#8A8A8A]">
                      <ArrowUpRight size={13} weight="thin" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MOBILE VIEW (Header -> 3D Interactive Asset Stage -> Projects Deck) */}
        <div className="md:hidden flex flex-col space-y-4 pointer-events-auto">
          {/* Mobile Header Card */}
          <div className="bg-[#242424]/95 backdrop-blur-md border border-dotted border-[#3D3D3D] p-5">
            <div className="eyebrow mb-2">
              <span className="sq" />
              <span>FEATURED ENGINEERING PROJECTS</span>
            </div>
            <h2 className="font-display text-2xl text-[#F0F0F0] mb-2">
              Production <em>software</em> showcase.
            </h2>
            <div className="inline-flex items-center gap-2 font-mono text-[9px] text-[#FE6E00]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FE6E00] animate-pulse" />
              <span>DRAG 3D MODEL ABOVE • SELECT PROJECTS BELOW</span>
            </div>
          </div>

          {/* Tactical 3D Avionics Observation HUD Stage */}
          <div className="h-[290px] w-full border border-dotted border-[#FE6E00]/40 bg-[#1A1A1A]/30 relative overflow-hidden flex flex-col justify-between p-2.5">
            {/* 4 Corner Reticles */}
            <span className="absolute top-1 left-1 font-mono text-xs text-[#FE6E00] leading-none select-none">┌</span>
            <span className="absolute top-1 right-1 font-mono text-xs text-[#FE6E00] leading-none select-none">┐</span>
            <span className="absolute bottom-1 left-1 font-mono text-xs text-[#FE6E00] leading-none select-none">└</span>
            <span className="absolute bottom-1 right-1 font-mono text-xs text-[#FE6E00] leading-none select-none">┘</span>

            {/* Top Tactical Status Bar */}
            <div className="flex items-center justify-between z-10">
              <span className="font-mono text-[8px] text-[#FE6E00] tracking-[0.1em] bg-[#1A1A1A]/90 px-2 py-0.5 border border-dotted border-[#FE6E00]/40 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3A7A65] animate-pulse" />
                // 3D SCOUT // RTK FIXED
              </span>
              <span className="font-mono text-[8px] text-[#38BDF8] bg-[#1A1A1A]/90 px-2 py-0.5 border border-dotted border-[#38BDF8]/40">
                GYRO 360° TOUCH
              </span>
            </div>

            {/* Bottom Live Flight Telemetry Ribbon */}
            <div className="z-10 bg-[#1A1A1A]/95 border border-dotted border-[#3D3D3D] px-2.5 py-1.5 flex items-center justify-between font-mono text-[8px] text-[#D6D6D6]">
              <div className="flex items-center gap-2">
                <span className="text-[#FE6E00]">ALT 120M</span>
                <span className="text-[#3D3D3D]">|</span>
                <span className="text-[#3A7A65]">SPD 14M/S</span>
                <span className="text-[#3D3D3D]">|</span>
                <span className="text-[#FFB74D]">BAT 94%</span>
              </div>
              <div className="text-[#8A8A8A] tracking-wider truncate max-w-[130px]">
                {activeProject?.title.toUpperCase() || "CSPDCL GIS"}
              </div>
            </div>
          </div>

          {/* Mobile Projects Controller Deck */}
          <div className="bg-[#242424]/95 backdrop-blur-md border border-dotted border-[#3D3D3D] p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-dotted border-[#3D3D3D]">
              <span className="meta-label text-[9px] text-[#8A8A8A]">SELECT PROJECT</span>
              <span className="font-mono text-[9px] text-[#FE6E00]">
                ACTIVE: [0{PROJECTS.findIndex(p => p.id === (activeProject?.id || PROJECTS[0].id)) + 1}/0{PROJECTS.length}]
              </span>
            </div>

            {/* 4-Segmented Quick Selection Tabs */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {PROJECTS.map((proj, idx) => {
                const isSelected = (activeProject?.id || PROJECTS[0].id) === proj.id;
                return (
                  <button
                    key={proj.id}
                    onClick={() => {
                      playIndustrialClick();
                      onHoverProject?.(proj);
                      onSelectProject(proj);
                    }}
                    className={`py-2 text-center font-mono text-[10px] uppercase border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FE6E00] text-[#111111] font-bold border-[#FE6E00]"
                        : "bg-[#1A1A1A] text-[#8A8A8A] border-dotted border-[#3D3D3D] hover:text-[#F0F0F0]"
                    }`}
                  >
                    {`0${idx + 1}`}
                  </button>
                );
              })}
            </div>

            {/* Selected Project Summary Card */}
            {(() => {
              const currentProj = activeProject || PROJECTS[0];
              return (
                <div className="p-3.5 bg-[#1A1A1A] border border-dotted border-[#3D3D3D]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[9px] text-[#FE6E00] uppercase tracking-wider">
                      SELECTED CASE STUDY
                    </span>
                    <span className="px-1.5 py-0.5 bg-[#242424] font-mono text-[8px] text-[#3A7A65] border border-dotted border-[#3A7A65]/40 uppercase">
                      PRODUCTION READY
                    </span>
                  </div>

                  <h3 className="font-display text-base text-[#F0F0F0] mb-1">
                    {currentProj.title}
                  </h3>
                  <p className="font-sans text-xs text-[#8A8A8A] mb-3 leading-relaxed">
                    {currentProj.subtitle}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {currentProj.tags.slice(0, 3).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.06em] bg-[#242424] text-[#8A8A8A] border border-dotted border-[#3D3D3D]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      playTelemetryDispatch();
                      onSelectProject(currentProj);
                    }}
                    className="btn-primary w-full justify-between !py-2.5 !px-4 !text-[11px] font-mono tracking-[0.08em]"
                  >
                    <span>VIEW PROJECT CASE STUDY</span>
                    <ArrowUpRight size={13} weight="thin" />
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 04: TRANSMISSION TERMINAL (§6.4.A ANCHOR CARD)
      ========================================================================= */}
      <section
        id="section-contact"
        className="min-h-screen flex flex-col justify-center items-start px-4 sm:px-6 lg:px-8 py-20 md:py-28 max-w-[1200px] mx-auto pointer-events-none"
      >
        {/* Mobile 3D Grid Transmission Observation Window */}
        <div className="md:hidden w-full h-[180px] border border-dotted border-[#FE6E00]/30 bg-[#1A1A1A]/30 relative mb-4 flex items-start justify-between p-2.5 pointer-events-none">
          <span className="font-mono text-[8px] text-[#FE6E00] tracking-[0.1em] bg-[#1A1A1A]/90 px-2 py-0.5 border border-dotted border-[#FE6E00]/30">
            // 3D TRANSMISSION GRID MAST
          </span>
          <span className="font-mono text-[8px] text-[#3A7A65] bg-[#1A1A1A]/90 px-2 py-0.5 border border-dotted border-[#3A7A65]/30">
            765KV BUS ACTIVE
          </span>
        </div>

        <div className="w-full max-w-xl md:max-w-lg bg-[#242424] border border-dotted border-[#3D3D3D] p-6 sm:p-8 pointer-events-auto shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-dotted border-[#3D3D3D] pb-4 mb-6">
            <div className="eyebrow">
              <span className="sq" />
              <span>GET IN TOUCH // RECRUITER CONTACT</span>
            </div>
            <span className="meta-label text-[#3A7A65]">AVAILABLE FOR HIRE</span>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl text-[#F0F0F0] mb-2">
            Let's discuss <em>opportunities</em>.
          </h2>
          <p className="text-[#8A8A8A] text-sm font-sans mb-6">
            I am actively open to Software Engineer, Frontend Engineer, and Full-Stack roles. Reach out directly or submit an inquiry regarding full-time openings or technical interviews.
          </p>

          {formSubmitted ? (
            <div className="p-4 bg-[#1A1A1A] border border-dotted border-[#3A7A65] text-[#72A899] font-mono text-xs">
              ✓ Message received! Thank you for reaching out; I will respond to your email within 24 hours.
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-5">
              {formError && (
                <div className="p-3 bg-[#1A1A1A] border border-dotted border-[#FE6E00] text-[#FE6E00] font-mono text-xs">
                  ⚠ {formError}
                </div>
              )}
              <div>
                <label className="meta-label block mb-1">
                  YOUR NAME / RECRUITER NAME
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sarah Jenkins (Technical Recruiter)"
                  className="w-full px-3 py-2 bg-transparent border-b border-dotted border-[#3D3D3D] text-[#F0F0F0] placeholder-[#8A8A8A]/50 font-mono text-xs focus:border-[#FE6E00] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="meta-label block mb-1">
                  EMAIL ADDRESS / WORK EMAIL
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. sarah@company.com"
                  className="w-full px-3 py-2 bg-transparent border-b border-dotted border-[#3D3D3D] text-[#F0F0F0] placeholder-[#8A8A8A]/50 font-mono text-xs focus:border-[#FE6E00] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="meta-label">
                    ROLE OVERVIEW & OPPORTUNITY DETAILS
                  </label>
                  <span
                    className={`font-mono text-[9px] ${
                      formData.message.trim().length >= 20
                        ? "text-[#3A7A65]"
                        : "text-[#FE6E00]"
                    }`}
                  >
                    {formData.message.trim().length}/20 MIN CHARACTERS
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  minLength={20}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Share role overview, tech stack requirements, location/remote details, or interview availability (min. 20 characters)..."
                  className="w-full px-3 py-2 bg-transparent border-b border-dotted border-[#3D3D3D] text-[#F0F0F0] placeholder-[#8A8A8A]/50 font-mono text-xs focus:border-[#FE6E00] focus:outline-none transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full justify-center !py-2.5 !px-4 !text-[11px] font-mono tracking-[0.08em] disabled:opacity-50"
              >
                <span>{isSubmitting ? "TRANSMITTING INQUIRY..." : "SEND MESSAGE"}</span>
                <PaperPlaneTilt size={14} weight="thin" />
              </button>
            </form>
          )}

          {/* Social Protocols Strip */}
          <div className="mt-8 pt-4 border-t border-dotted border-[#3D3D3D] flex flex-wrap items-center justify-between gap-3">
            <span className="meta-label text-[9px]">DIRECT CONTACT:</span>
            <div className="flex items-center gap-4">
              <a
                href={PERSONAL_INFO.github}
                target="_blank"
                rel="noreferrer"
                className="meta-label flex items-center gap-1.5 text-[#D6D6D6] hover:text-[#FE6E00] transition-colors"
              >
                <GithubLogo size={14} weight="thin" />
                <span>GITHUB</span>
              </a>
              <a
                href={PERSONAL_INFO.linkedin}
                target="_blank"
                rel="noreferrer"
                className="meta-label flex items-center gap-1.5 text-[#D6D6D6] hover:text-[#FE6E00] transition-colors"
              >
                <LinkedinLogo size={14} weight="thin" />
                <span>LINKEDIN</span>
              </a>
              <a
                href={`mailto:${PERSONAL_INFO.email}`}
                className="meta-label flex items-center gap-1.5 text-[#D6D6D6] hover:text-[#FE6E00] transition-colors"
              >
                <EnvelopeSimple size={14} weight="thin" />
                <span>EMAIL</span>
              </a>
            </div>
          </div>

          {/* Operations Strip */}
          <div className="mt-3 pt-3 border-t border-dotted border-[#3D3D3D]/60 flex items-center justify-between text-[9px] font-mono text-[#8A8A8A]">
            <span>ENGINEERED WITH NEXT.JS 16 & THREE.JS</span>
            <a
              href="/admin"
              className="text-[#8A8A8A]/40 hover:text-[#FE6E00] transition-colors p-1"
              aria-label="Secure portal"
            >
              <LockSimple size={13} weight="thin" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
