const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generatePDF() {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: true
  });

  const outputFilePath = path.join(__dirname, '..', 'TriSphere_Feature_Directory.pdf');
  const stream = fs.createWriteStream(outputFilePath);
  doc.pipe(stream);

  // Set colors
  const primaryColor = '#1e3a8a';   // Deep Blue
  const secondaryColor = '#0f766e'; // Teal
  const darkTextColor = '#1e293b';  // Slate 800
  const lightTextColor = '#64748b'; // Slate 500
  const lightBgColor = '#f8fafc';   // Slate 50

  // 1. Cover / Header Page
  doc.rect(0, 0, doc.page.width, 240).fill('#0f172a');
  
  // Title
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(28)
     .text('TriSphere', 50, 60)
     .fontSize(22)
     .fillColor('#60a5fa')
     .text('Complete Feature Directory', 50, 95);

  doc.fillColor('#94a3b8')
     .font('Helvetica')
     .fontSize(12)
     .text('Complete overview of dashboard capabilities across all user roles', 50, 140)
     .text(`Generated on: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 50, 160);

  // Add a nice horizontal separator line
  doc.moveTo(50, 210).lineTo(doc.page.width - 50, 210).strokeColor('#334155').lineWidth(1).stroke();

  doc.y = 260; // reset cursor y position below header background

  const sections = [
    {
      title: '1. Student Dashboard (Gamified & Wellness-Focused)',
      color: primaryColor,
      groups: [
        {
          name: 'Home Hub',
          bullets: [
            'Timetable & Study Streak: Weekly visual calendar showing upcoming lectures and study schedules.',
            'Daily Planner: Integration of tasks, quizzes, and simulations due in the current week.',
            'ASTRA Daily Check-in: Real-time empathetic voice agent for mood check-ins with selfie-camera opt-in visual emotion tracking (Llama 4 Vision).'
          ]
        },
        {
          name: 'Learn & Simulations',
          bullets: [
            'Interactive Learn Pane: Browse chapters, watch lectures, and download textbook materials.',
            'Engagement-Locked Player: Tracks tab-switching or video skips during lectures and flags warnings.',
            'Simulation Lab: Integrated PhET HTML5 Science simulations and GeoGebra Math tools inside the viewport.',
            'Lab Notebook & Evidence: Data recorder sheet for parameters and direct verification screenshot uploader.'
          ]
        },
        {
          name: 'Gamification & AI Assistance',
          bullets: [
            'Lernix AI Chatbot: Secure daily-limit tracked AI companion in Firestore to prevent local storage bypass.',
            'Milestone Badges: Collectible avatar profile cards (e.g. Astronaut, Wizard, Superhero) based on study XP.',
            'Rewards Store: Exchange earned study XP for profile frames and student customization perks.',
            'Class Leaderboard: Real-time XP-based ranking across classroom peers.'
          ]
        },
        {
          name: 'Tools & Discussions',
          bullets: [
            'Student Tools: PDF markup reader, scientific calculator, notes pad, and coordinate grapher.',
            'Chat & Forums: Private 1-on-1 messaging with faculty and classmates, plus public category forum boards.'
          ]
        }
      ]
    },
    {
      title: '2. Teacher Dashboard (Management & Grading Hub)',
      color: secondaryColor,
      groups: [
        {
          name: 'Overview & Material Builder',
          bullets: [
            'Resource Center: Publish lessons, syllabus timelines, and upload textbook PDF resources targeted by class/grade.',
            'Analytics Dashboard: Real-time overview of active student counts, pending tasks, and meeting requests.'
          ]
        },
        {
          name: 'Assignment & Lab Creator',
          bullets: [
            'Interactive Builder: Form to select, description, and assign PhET or GeoGebra virtual experiments.',
            'Parameter Configurator: Define variables that students must log during simulations (e.g. Voltage, Current).',
            'Subject Lockdown: Automatically constraints subject selection to the teacher\'s subject (Chemistry, Physics, Biology) with developer sandbox bypass.'
          ]
        },
        {
          name: 'Grading & Class Directory',
          bullets: [
            'Grading Center: Interface to review textbook homework, assign grades, and submit feedback comments.',
            'Simulation Lab Grading Overlay: Displays student parameter values side-by-side with fullscreen lightbox previews of verification screenshots.',
            'Student Directory: Inspect student progress cards, quiz logs, and ASTRA mood tracking check-in histories.',
            'Announcements Broadcaster: Form to post class-wide notices and reminders.'
          ]
        }
      ]
    },
    {
      title: '3. Parent Dashboard (Safety & Academic Oversight)',
      color: '#4f46e5', // Indigo
      groups: [
        {
          name: 'Child Activity & Progress Tracking',
          bullets: [
            'Home Performance: Instant overview of average quiz scores, streak status, active alerts, and study hours.',
            'Engagement Charts: Time tracking breakdowns showing duration spent on textbooks, quizzes, and Lernix AI.',
            'Grade Visualizers: Trend graphs charting child\'s academic scores over time.',
            'Curriculum Syllabus Reports: Track lesson completion rates and syllabus progress.'
          ]
        },
        {
          name: 'Wellness & Communication',
          bullets: [
            'ASTRA Mood Analysis: Log history showing emotional check-in outcomes categorized into wellness ranges (positive, neutral, sensitive mood triggers).',
            'Teacher Bookings: Scheduler to request and book consultation conferences with school teachers.',
            'School Broadcasts: Direct access to school-wide and class announcements.'
          ]
        }
      ]
    },
    {
      title: '4. Admin Dashboard (Principal Hub & System Console)',
      color: '#0f172a', // Slate 900
      groups: [
        {
          name: 'User & System Administration',
          bullets: [
            'Global Dashboard: Core system statistics showing total students, faculty, and guardian counts.',
            'User Directories: Searchable, editable registers for Students, Parents, and Teachers (including lesson plan access).',
            'Enrollment Module: Register new user accounts and assign default roles (Admins, Teachers, Students, Parents).'
          ]
        },
        {
          name: 'Academic Reports & Broadcasts',
          bullets: [
            'School Progress: View grade distributions, average scores, and curriculum tracking charts.',
            'Broadcast Console: Broadcast administrative bulletins and emergency alerts to all roles.'
          ]
        },
        {
          name: 'Integrity Logs & Content Management',
          bullets: [
            'Video Integrity Audit: Real-time logs detailing tab-switches, skipped videos, or lecture url violations during assigned video watch periods.',
            'Knowledge Base Manager: Control panel to edit school FAQs, custom guide pages, and AI-guided replies.'
          ]
        }
      ]
    }
  ];

  sections.forEach((sec, secIdx) => {
    // Check space before adding section
    if (doc.y > doc.page.height - 150) {
      doc.addPage();
    } else if (secIdx > 0) {
      doc.moveDown(1.5);
    }

    // Section Header
    doc.fillColor(sec.color)
       .font('Helvetica-Bold')
       .fontSize(16)
       .text(sec.title)
       .moveDown(0.4);

    sec.groups.forEach((group) => {
      // Check space before adding group
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
      }

      // Group Name
      doc.fillColor(darkTextColor)
         .font('Helvetica-Bold')
         .fontSize(12)
         .text(group.name, { underline: false })
         .moveDown(0.25);

      group.bullets.forEach((bullet) => {
        // Parse bold start in bullet point (e.g. "Title: Description")
        const parts = bullet.split(': ');
        const label = parts[0] + ': ';
        const desc = parts.slice(1).join(': ');

        // Check space before bullet (rough estimation)
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
        }

        // Draw bullet point
        const startX = doc.x;
        const currentY = doc.y;

        doc.fillColor(sec.color)
           .font('Helvetica-Bold')
           .fontSize(10)
           .text('•  ', startX, currentY);

        const textX = startX + 12;
        doc.fillColor(darkTextColor)
           .font('Helvetica-Bold')
           .fontSize(10)
           .text(label, textX, currentY, { continued: true })
           .fillColor(lightTextColor)
           .font('Helvetica')
           .text(desc);

        doc.moveDown(0.35);
      });

      doc.moveDown(0.4);
    });
  });

  // Footer / Page Numbers handling
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    // Draw footer
    doc.fillColor('#94a3b8')
       .font('Helvetica')
       .fontSize(8)
       .text(
         `Page ${i + 1} of ${range.count}   |   TriSphere Corporate Educational Framework`,
         50,
         doc.page.height - 40,
         { align: 'center', width: doc.page.width - 100 }
       );
  }

  doc.end();

  stream.on('finish', () => {
    console.log('PDF generation complete. Saved to:', outputFilePath);
  });
}

generatePDF();
