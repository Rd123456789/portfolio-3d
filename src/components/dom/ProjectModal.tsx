"use client";

import React, { useEffect } from "react";
import { Project } from "@/lib/projects";
import { X, ArrowUpRight, Check, GithubLogo } from "@phosphor-icons/react";
import { playIndustrialClick } from "@/lib/sound";

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export default function ProjectModal({ project, onClose }: ProjectModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        playIndustrialClick();
        onClose();
      }
    };
    if (project) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      document.documentElement.classList.add("lenis-stopped");
      if (typeof window !== "undefined" && (window as any).__lenis) {
        (window as any).__lenis.stop();
      }
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
      document.documentElement.classList.remove("lenis-stopped");
      if (typeof window !== "undefined" && (window as any).__lenis) {
        (window as any).__lenis.start();
      }
    };
  }, [project, onClose]);

  if (!project) return null;

  const handleClose = () => {
    playIndustrialClick();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 popup-backdrop"
      onClick={handleClose}
      data-lenis-prevent="true"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="relative w-full max-w-2xl bg-[#242424] border border-dotted border-[#3D3D3D] p-4 sm:p-8 max-h-[88vh] overflow-y-auto shadow-2xl overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
      >
        {/* Top Eyebrow, Title, Role & Close */}
        <div className="flex items-start justify-between mb-5 border-b border-dotted border-[#3D3D3D] pb-4">
          <div className="space-y-2 pr-2 sm:pr-4">
            <div className="eyebrow flex items-center gap-2">
              <span className="sq shrink-0" />
              <span className="text-[9px] sm:text-[10px] tracking-widest truncate max-w-[240px] sm:max-w-[480px]">
                {project.company ? `${project.company} // CASE STUDY` : "ENGINEERING CASE STUDY"}
              </span>
            </div>

            <h2 className="font-display text-2xl sm:text-4xl text-[#F0F0F0] leading-snug tracking-[-0.01em]">
              {project.title}
            </h2>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
              <span className="px-2 py-0.5 bg-[#1A1A1A] text-[#FE6E00] border border-dotted border-[#FE6E00]/40 font-mono text-[9.5px] sm:text-[11px] uppercase tracking-wider font-medium">
                {project.role}
              </span>
              <span className="text-[#8A8A8A] font-mono text-[9.5px] sm:text-[11px] uppercase tracking-wider leading-relaxed">
                // {project.subtitle}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="p-1.5 sm:p-2 border border-dotted border-[#3D3D3D] text-[#8A8A8A] hover:text-[#F0F0F0] hover:border-[#F0F0F0] transition-colors cursor-pointer shrink-0"
          >
            <X size={18} weight="thin" />
          </button>
        </div>

        {/* Narrative Body */}
        <p className="text-[#D6D6D6] text-xs sm:text-base leading-relaxed mb-5 font-sans">
          {project.description}
        </p>

        {/* Deliverables Block */}
        {project.highlights && project.highlights.length > 0 && (
          <div className="mb-5 p-3.5 sm:p-5 border border-dotted border-[#3D3D3D] bg-[#1A1A1A]">
            <div className="meta-label text-[#FE6E00] mb-2.5 leading-normal text-[8.5px] sm:text-[10px]">
              TECHNICAL HIGHLIGHTS & ARCHITECTURE
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#D6D6D6] font-sans">
              {project.highlights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <Check size={14} weight="thin" className="text-[#3A7A65] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Telemetry Stats Grid (Responsive Key-Value Rows on Mobile, 3-Col Grid on Desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 border border-dotted border-[#3D3D3D] bg-[#1A1A1A]/40 mb-5">
          {project.stats.map((stat, i) => (
            <div
              key={i}
              className="p-2.5 sm:p-4 border-b sm:border-b-0 sm:border-r last:border-b-0 sm:last:border-r-0 border-dotted border-[#3D3D3D] flex sm:flex-col items-center justify-between sm:justify-center gap-1.5"
            >
              <div className="meta-label order-1 sm:order-2 text-[8.5px] sm:text-[9px] text-[#8A8A8A] uppercase tracking-wider leading-normal">
                {stat.label}
              </div>
              <div className="font-mono text-xs sm:text-base font-bold text-[#F0F0F0] order-2 sm:order-1 whitespace-nowrap">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Integrated Stacks */}
        <div className="mb-6">
          <div className="meta-label mb-2 text-[8.5px] sm:text-[10px] leading-normal">TECHNOLOGY STACK</div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {project.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 font-mono text-[9.5px] sm:text-[11px] uppercase tracking-[0.08em] bg-[#1A1A1A] text-[#D6D6D6] border border-dotted border-[#3D3D3D]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3.5 border-t border-dotted border-[#3D3D3D]">
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary justify-center !py-2 sm:!py-2.5 !px-4 !text-[11px] font-mono tracking-[0.08em]"
            >
              <span>VIEW LIVE APPLICATION</span>
              <ArrowUpRight size={14} weight="thin" />
            </a>
          )}
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost justify-center !py-2 sm:!py-2.5 !px-4 !text-[11px] font-mono tracking-[0.08em]"
            >
              <GithubLogo size={16} weight="thin" />
              <span>SOURCE CODE</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
