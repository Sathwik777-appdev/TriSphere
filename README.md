                                          TriSphere

Enterprise AI Learning and Student Wellbeing Ecosystem

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react\&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite\&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js\&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8.3-119EFF?logo=capacitor\&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Admin%20and%20Client-FFCA28?logo=firebase\&logoColor=black)
![AI](https://img.shields.io/badge/AI-Groq%20%7C%20DeepSeek%20%7C%20Gemini-FF6F00)

TriSphere is an intelligent, curriculum-aligned educational platform built for schools, students, teachers, and parents. It integrates twenty-four-seven personal AI tutoring, interactive STEM and robotics simulation labs, proactive mental wellbeing monitoring, and role-based institutional management into a unified cross-platform application.

---

Key Features

* Lernix AI Personal Tutor**: Socratic homework helper, step-by-step math solver, handwritten work recognition, and adaptive quiz generation.
* ASTRA Student Wellbeing**: Proactive emotional check-ins, sentiment tracking, multi-stage crisis safety alerts, and counselor escalation.
* Virtual Simulation Labs**: Interactive science experiments and trial notebooks powered by PhET and 3D visual models.
* RoboLab Studio**: Flowchart logic builder, sensor circuit simulations, and visual programming sandbox.
* Gamified Motivation Engine**: Learning streaks, experience points, leaderboard rankings, and custom animated profile frames.
* Institutional Role Portals**: Dedicated dashboards for Students, Teachers, Parents, School Principals, and System Developers.
* Native Cross-Platform Support**: Progressive Web App and Android native application with offline caching and on-device speech processing.

---

Core Modules

1. Lernix AI Personal Tutor

Designed to teach rather than simply give answers. It guides students using structured Socratic questioning, renders mathematical expressions, recognizes homework through on-device text scanning, and creates practice quizzes matching school syllabi.

2. ASTRA Wellbeing and Counseling

Provides private daily emotional check-ins using spoken voice and text. Built-in safety filters detect distress, academic anxiety, or bullying, immediately notifying designated school counselors while respecting student privacy.

3. STEM Virtual Labs and RoboLab

Enables students to conduct physics, chemistry, and biology experiments digitally. Students adjust variables, record observations, and generate lab reports. The RoboLab module introduces students to computational thinking through block-based logic.

4. Unified Multi-Role Portals

* Student Dashboard**: Daily homework tracker, revision guides, practice tests, rewards store, and nighttime curfew protection.
* Teacher Dashboard**: Homework creator, automated grading, attendance monitoring, and student concept mastery graphs.
* Parent Dashboard**: Real-time progress updates, attendance logs, wellbeing notifications, and direct teacher messaging.
* Principal Dashboard**: School-wide academic metrics, grade performance analytics, teacher workloads, and bulk promotions.
* Developer Console**: Live system health, uptime logs, circuit breaker status, and database maintenance tools.

---

Multi-Tier AI Architecture

TriSphere guarantees round-the-clock availability using an automatic multi-tier fallback pipeline with circuit breakers:

```text
Student Request
      │
      ▼
Tier 1: Groq AI (Llama 3.3 70B / 8B) ──[Success]──> Delivered
      │
      ▼ (Fallback on Rate Limit or Error)
Tier 2: DeepSeek Chat (DeepSeek-V3)  ──[Success]──> Delivered
      │
      ▼ (Fallback on Failover)
Tier 3: Google Gemini Flash (2.0)    ──[Success]──> Delivered
```

* Zero-Cost Audio**: Speech-to-text and text-to-speech run directly on the student device using native mobile engines.
* Usage Safeguards**: Strict rate limits of 80 to 120 queries per fifteen minutes prevent system misuse and runaway costs.

---

Technology Stack

| Layer                 | Technologies                                                                           |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Frontend**          | React 18, Vite 5, Tailwind CSS, Framer Motion, Recharts, KaTeX, Three.js, Lucide Icons |
| **Mobile Native**     | Capacitor 8.3, Android Native Plugins for Speech, Audio, and App Security              |
| **Backend**           | Node.js, Express, Helmet, CORS, Rate Limiters, Node-Cron                               |
| **Database and Auth** | Firebase Firestore, Firebase Authentication, Firebase Storage, Firebase App Check      |
| **AI and Processing** | Groq SDK, DeepSeek API, Google Gemini Flash, Tesseract OCR, PDF.js                     |

---

Repository Structure

```text
TriSphere/
├── android/          Native Android application project and bundled assets
├── backend/          Node.js Express server, API routes, and safety services
│   ├── routes/       AI, Tutor, Reports, System, Auth, and Learning APIs
│   ├── services/     ASTRA Safety, Concept Graph, and Tutor engines
│   ├── utils/        Fallback pipeline, rate limiters, and circuit breakers
│   └── server.js     Server entry point and school leaderboard caching
├── frontend/         React and Vite single-page application
│   ├── public/       Static assets, vector frames, and icons
│   ├── src/          Components, pages, contexts, and helper utilities
│   └── vite.config   Frontend build and service worker configuration
└── functions/        Firebase Cloud Functions and automated triggers
```

---

Getting Started

Prerequisites

* Node.js version 20 or higher
* npm version 10 or higher
* Firebase account with Firestore, Authentication, and Storage configured
* Android Studio (optional, needed only to compile Android release builds)

Installation Steps

1. Clone the repository

```bash
git clone https://github.com/your-username/trisphere.git
cd trisphere
```

2. Install frontend dependencies

```bash
cd frontend
npm install
```

3. Install backend dependencies

```bash
cd ../backend
npm install
```

---

Configuration

Backend Environment (`backend/.env`)

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

GROQ_API_KEY=your_groq_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

CRON_KEY=your_secure_cron_key_here
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```
Frontend Environment (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

Running the Application

Start the Backend API Server

Open the first terminal:

```bash
cd backend
npm run dev
```

Start the Frontend Application

Open the second terminal:

```bash
cd frontend
npm run dev
```

---

Android Deployment

1. Build the Production Web Bundle

```bash
cd frontend
npm run build
```

2. Sync the Compiled Assets and Plugins to Android

```bash
npx cap sync android
```

3. Open in Android Studio

```bash
npx cap open android
```

You can then use Android Studio to build and generate the signed APK.

---

Security and Reliability

* School Data Isolation**: Multi-tenant rules ensure data is strictly scoped per school.
* Student Sleep Curfew**: Automatic account lockout during late night hours promotes student wellbeing.
* Privacy Protection**: Mobile screen automatically blurs academic records when switching apps.
* Abuse Prevention**: Rate limiters and circuit breakers prevent API quota exhaustion and denial-of-service threats.
* Memory Caching**: School leaderboards are cached in memory for fifteen minutes to reduce database read costs.

---

Project Vision

TriSphere is designed to bring learning, student wellbeing, AI assistance, simulation-based education, and school administration together within a single intelligent ecosystem.

By combining AI-powered personalization with practical STEM tools, wellbeing support, gamification, and institutional management, TriSphere aims to provide a connected digital environment for students, teachers, parents, and school administrators.

---
TriSphere
Transforming Education Through Intelligent Technology**
