export interface Project {
  id: string;
  title: string;
  subtitle: string;
  role: string;
  company?: string;
  description: string;
  highlights: string[];
  tags: string[];
  color: string;
  accent: string;
  liveUrl?: string;
  githubUrl?: string;
  stats: { label: string; value: string }[];
}

export interface ExperienceItem {
  period: string;
  role: string;
  company: string;
  location: string;
  description: string[];
  technologies: string[];
}

export interface EducationItem {
  period: string;
  degree: string;
  institution: string;
  location: string;
}

export const PERSONAL_INFO = {
  name: "Rajdip Parmar",
  title: "Software Engineer",
  tagline: "Specializing in Full-Stack Web, Cross-Platform Mobile & Enterprise GIS Systems",
  bio: "Results-driven Software Engineer with 3+ years of production experience developing high-scale web frontends and offline-first mobile applications using Angular, React, Ionic, and TypeScript. Core domain expertise in interactive GIS mapping (Leaflet, Google Maps APIs), spatial asset management, and enterprise mobile architectures supporting 5,000+ daily active field users.",
  email: "rajdipparmar221@gmail.com",
  phone: "+91 8200511762",
  location: "Ahmedabad, India",
  status: "OPEN TO NEW OPPORTUNITIES",
  linkedin: "https://linkedin.com/in/rajdip-parmar-421a60217",
  github: "https://github.com/Rd123456789",
  stats: [
    { label: "ENGINEERING EXP", value: "3+ Years" },
    { label: "ACTIVE USERS", value: "5,000+" },
    { label: "ENTERPRISE APPS", value: "4+ Scaled" },
    { label: "CORE FOCUS", value: "Full-Stack" },
  ],
};

export const PROJECTS: Project[] = [
  {
    id: "cspdcl-gis",
    title: "CSPDCL Grid GIS",
    subtitle: "Electrical Distribution Network Asset Mapper",
    role: "Lead Mobile & GIS Engineer",
    company: "Chhattisgarh State Power Distribution Company Limited",
    description:
      "Enterprise GIS-based cross-platform mobile application enabling state-wide field engineers to digitally survey, trace, and manage the high/low voltage electrical distribution grid across Chhattisgarh.",
    highlights: [
      "Built interactive GIS asset-mapping and drawing tools with Leaflet & custom vector layers.",
      "Engineered offline data caching with SQLite and background sync for zero-connectivity zones.",
      "Supports 5,000+ daily field technicians in live state-wide production.",
    ],
    tags: ["Ionic", "Angular", "TypeScript", "Leaflet", "GIS", "SQLite", "Capacitor"],
    color: "#06b6d4",
    accent: "from-cyan-500 to-blue-600",
    stats: [
      { label: "Daily Field Users", value: "5,000+" },
      { label: "Network Mapping", value: "Real-time GIS" },
      { label: "Offline Mode", value: "SQLite Sync" },
    ],
  },
  {
    id: "track-fields",
    title: "Track-Fields",
    subtitle: "GIS-Enabled Field Operations & Inspection Platform",
    role: "Mobile Architect & Frontend Developer",
    company: "Tadvid Info Technologies",
    description:
      "A ruggedized GIS-enabled field inspection and project-monitoring ecosystem supporting GPS-based ground audits, geo-tagged camera capture, and dynamic JSON schema-driven inspection forms.",
    highlights: [
      "GPS-accurate polygon boundary demarcation and interactive spatial layers.",
      "Dynamic JSON schema form generator with conditional validation and photo watermarking.",
      "Robust conflict-resolution engine for offline-to-online sync pipelines.",
    ],
    tags: ["Angular", "Ionic", "Capacitor", "GIS Mapping", "RxJS", "SCSS"],
    color: "#6366f1",
    accent: "from-indigo-500 to-purple-600",
    stats: [
      { label: "Data Capture", value: "Geo-Tagged" },
      { label: "Form Engine", value: "Dynamic JSON" },
      { label: "Architecture", value: "Offline-First" },
    ],
  },
  {
    id: "kishan-guru",
    title: "KishanGuru",
    subtitle: "Digital Agriculture & Geospatial Farm Platform",
    role: "Lead Mobile Developer",
    company: "Tadvid Info Technologies",
    description:
      "Mobile-first spatial agriculture ecosystem empowering farmers with GPS farm boundary mapping, satellite index analytics, crop lifecycle tracking, and agricultural marketplace operations.",
    highlights: [
      "Interactive farm boundary polygon drawing tool with automated area calculation.",
      "Satellite vegetation index and localized weather data integration.",
      "Multi-step crop disease diagnostic workflows and farm expense accounting.",
    ],
    tags: ["Ionic", "Angular", "Leaflet", "Satellite APIs", "Push Notifications", "Android"],
    color: "#10b981",
    accent: "from-emerald-500 to-teal-600",
    stats: [
      { label: "Spatial Tech", value: "Farm GPS" },
      { label: "Data Sources", value: "Satellite + Weather" },
      { label: "Domain", value: "AgriTech" },
    ],
  },
  {
    id: "solar-mapping",
    title: "Rooftop Solar CAD Planner",
    subtitle: "Google Roof API & Automated Panel Layout Engine",
    role: "Full-Stack & Geospatial Engineer",
    company: "French Solar Energy Client",
    description:
      "Interactive geospatial CAD and solar estimation platform developed for a French solar energy firm. Integrates the Google Solar Rooftop API to fetch building footprints and extract precise roof bounds. Built an interactive canvas where engineers can manually position individual photovoltaic panels or trigger a one-click auto-fill algorithm that densely populates the roof bounding area with panels. Features real-time parametric configuration for inter-panel gap spacing and tilt angles, with exportable structural schematics utilized by field crews to install real solar arrays on roofs across France.",
    highlights: [
      "Integrated Google Solar Rooftop API to retrieve building boundaries, roof plane geometry, and solar irradiance bounds.",
      "Engineered interactive canvas tools for manual single-panel placement and one-click automated array filling across bounding rectangles.",
      "Built parametric configuration controls for panel pitch spacing, inter-row gaps, and tilt angles.",
      "Architected export pipelines generating structural CAD layout schematics and bill-of-materials used for real-world roof installations in France.",
    ],
    tags: ["React.js", "Google Solar API", "HTML5 Canvas", "TypeScript", "CAD Geometry", "Node.js"],
    color: "#f59e0b",
    accent: "from-amber-500 to-orange-600",
    stats: [
      { label: "Geometry Engine", value: "Google Solar API" },
      { label: "Array Placement", value: "Auto-Fill CAD" },
      { label: "Deployment Market", value: "France (EU)" },
    ],
  },
];

export const EXPERIENCES: ExperienceItem[] = [
  {
    period: "02/2024 – Present",
    role: "Software Engineer",
    company: "Tadvid Info Technologies",
    location: "Ahmedabad, India",
    description: [
      "Developed and maintained large-scale cross-platform mobile apps for Chhattisgarh State Power Distribution Company (CSPDCL) using Ionic, Angular & TypeScript.",
      "Built interactive GIS drawing and spatial asset-mapping tools using Leaflet, digitizing electrical distribution networks for 5,000+ daily field users.",
      "Engineered offline SQLite caching, camera hardware integrations, geolocation tracking, and dynamic JSON-driven form engines.",
      "Engineered React-based rooftop solar CAD platform for a French solar client using Google Solar API, automating panel array placement, spacing, tilt angles, and real-world installation exports.",
    ],
    technologies: [
      "Ionic",
      "Angular",
      "TypeScript",
      "Leaflet",
      "GIS/GPS",
      "Capacitor",
      "SQLite",
      "React.js",
      "Node.js",
      "PostgreSQL",
    ],
  },
  {
    period: "09/2022 – 01/2024",
    role: "Frontend Developer",
    company: "AIMDek Technologies Pvt Ltd",
    location: "Ahmedabad, India",
    description: [
      "Played a core role in developing enterprise frontend architectures using Angular 8, React, NGRX, and Angular Reactive Forms.",
      "Implemented clean dependency injection patterns, custom directives, and responsive interfaces with Angular Material UI & React Material UI.",
      "Active participant in Agile/SCRUM sprint release demos, retrospectives, and code review governance using Git, GitHub, and GitLab.",
    ],
    technologies: [
      "Angular 8",
      "React",
      "NGRX",
      "Redux Observable",
      "TypeScript",
      "Angular Material",
      "GitLab",
      "Agile/SCRUM",
    ],
  },
  {
    period: "01/2022 – 08/2022",
    role: "Project Intern",
    company: "L & T Technology Services (Knowledge City)",
    location: "Vadodara, India",
    description: [
      "Architected data pipelines leveraging InfluxDB, Python pandas, and FastAPI for real-time telemetry processing.",
      "Engineered graphical user interfaces using PyQt5 for hardware device diagnostics and internal engineering tools.",
      "Conducted cyber security protocol testing, including Lua PCAP network packet dissection and regex-based threat pattern detection.",
    ],
    technologies: [
      "Python",
      "FastAPI",
      "pandas",
      "InfluxDB",
      "PyQt5",
      "Lua PCAP",
      "Network Security",
    ],
  },
];

export const EDUCATION: EducationItem[] = [
  {
    period: "09/2020 – 06/2022",
    degree: "Master of Computer Applications (MCA)",
    institution: "Maharaja Sayajirao University of Baroda",
    location: "Vadodara, India",
  },
  {
    period: "07/2017 – 05/2020",
    degree: "Bachelor of Science in Information Technology (B.Sc. I.T.)",
    institution: "C.U. Shah University",
    location: "Wadhwan, India",
  },
];

export const SKILL_CATEGORIES = [
  {
    title: "GIS & Spatial Engineering",
    description: "Core specialization in interactive mapping and location-based telemetry",
    skills: [
      { name: "Leaflet GIS", level: "Expert", desc: "Custom layers & vector drawing" },
      { name: "Google Maps APIs", level: "Expert", desc: "Spatial clustering & polygons" },
      { name: "GPS & Geo-Tagging", level: "Master", desc: "Hardware location telemetry" },
      { name: "Three.js / WebGL", level: "Advanced", desc: "3D visual pipelines & shaders" },
    ],
  },
  {
    title: "Frontend & Mobile Ecosystem",
    description: "Cross-platform mobile and responsive enterprise web interfaces",
    skills: [
      { name: "Angular & NGRX", level: "Expert", desc: "Enterprise state & reactive forms" },
      { name: "Ionic & Capacitor", level: "Expert", desc: "Native hardware & plugins" },
      { name: "React.js & Next.js", level: "Advanced", desc: "Component architecture & SSR" },
      { name: "TypeScript", level: "Expert", desc: "Strict type safety & interfaces" },
    ],
  },
  {
    title: "Backend, Data & Cloud",
    description: "Scalable APIs, offline synchronization, and databases",
    skills: [
      { name: "Node.js & Express", level: "Proficient", desc: "RESTful API services" },
      { name: "PostgreSQL & SQL", level: "Advanced", desc: "Relational data structures" },
      { name: "SQLite Offline Sync", level: "Expert", desc: "Local device caching & sync" },
      { name: "Python & FastAPI", level: "Proficient", desc: "Data processing with pandas" },
    ],
  },
];

export const LANGUAGES = [
  { name: "English", fluency: "Professional Working" },
  { name: "Hindi", fluency: "Native / Bilingual" },
  { name: "Gujarati", fluency: "Native / Bilingual" },
];
