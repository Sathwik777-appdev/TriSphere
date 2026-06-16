import puppeteer from 'puppeteer';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatWithFallback } from '../utils/groqFallback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const groq = new Groq({ apiKey: (process.env.GROQ_API_KEY || '').trim() });
const TIMEOUT_MS = 60000;

/**
 * Helper: Fetch an image from a URL and return it as a Base64 Data URI.
 */
async function getBase64Image(url) {
    if (!url) return null;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error(`Failed to fetch image from ${url}:`, error.message);
        return null;
    }
}

/**
 * Generate an AI teacher remark for a student's monthly performance.
 */
export async function generateAIRemark(studentName, subjectScores, attendancePercent) {
    try {
        const subjectSummary = subjectScores
            .map(s => `${s.subject}: ${s.marks}/${s.total}`)
            .join(', ');

        const prompt = `You are a helpful school teacher. Write a short, encouraging 2-sentence remark for a monthly student progress report.
Student: ${studentName}
Subjects: ${subjectSummary}
Attendance: ${attendancePercent}%
Be specific about strengths and areas to improve. Keep it under 40 words.`;

        const { completion } = await chatWithFallback({ free: groq }, {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 100,
        });

        return completion.choices?.[0]?.message?.content?.trim() || 'Keep up the good work!';
    } catch (error) {
        console.error('AI Remark generation failed:', error.message);
        return 'The student has shown consistent effort this month. Keep up the good work!';
    }
}

/**
 * Build the HTML template for the student report.
 */
function buildReportHTML(data) {
    const {
        studentName, className, section, month, year,
        schoolName, profilePhoto, subjectScores, totalMarks, maxMarks,
        percentage, grade, attendanceData, attendancePercent,
        marksTrend, classComparison, aiRemark, trisphereLogo
    } = data;

    const attendanceChartData = JSON.stringify(attendanceData);
    const marksTrendData = JSON.stringify(marksTrend);
    const comparisonData = JSON.stringify(classComparison);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Progress Report - ${studentName}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Inter', sans-serif;
    background: #ffffff;
    color: #333333;
    padding: 0;
  }
  
  .page {
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    background: white;
    position: relative;
    padding: 8mm 10mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header Box */
  .school-name-box {
    border: 1px solid #000;
    padding: 8px;
    text-align: center;
    margin-bottom: 8px;
    width: 50%;
    margin-left: auto;
    margin-right: auto;
  }

  .school-name-box h1 {
    font-size: 26px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #333;
  }

  .report-header {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
  }

  .report-title-main {
    font-size: 32px;
    font-weight: 800;
    text-transform: uppercase;
    color: #444;
    letter-spacing: 1px;
    text-align: center;
  }

  /* Info Section */
  .info-section {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .info-left {
    width: 50%;
  }

  .info-right {
    width: 45%;
    text-align: right;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .section-label {
    font-size: 10px;
    font-weight: 800;
    color: #888;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #ddd;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;
  }

  .info-table td {
    padding: 6px 12px;
    border: 1px solid #dfdfdf;
    font-size: 12px;
    color: #444;
  }

  .info-table td:first-child {
    font-weight: 600;
    width: 110px;
    background: #fcfcfc;
    color: #666;
  }

  .student-name-display {
    font-size: 22px;
    font-weight: 800;
    margin-bottom: 4px;
    color: #333;
  }

  .student-sub-info {
    font-size: 13px;
    color: #666;
    margin-bottom: 4px;
    font-weight: 500;
  }

  /* Academic Performance */
  .performance-section {
    margin-bottom: 15px;
  }

  .performance-header {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 12px;
    border: 1px solid #000;
    height: 30px;
  }

  .performance-header h2 {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 0 12px;
    line-height: 28px;
  }

  .performance-header .arrow-container {
    width: 32px;
    height: 32px;
    position: relative;
    border-left: 1px solid #000;
  }

  .performance-header .arrow {
    position: absolute;
    top: 50%;
    left: 40%;
    transform: translate(-50%, -50%);
    width: 0;
    height: 0;
    border-top: 8px solid transparent;
    border-bottom: 8px solid transparent;
    border-left: 12px solid #333;
  }

  .perf-layout {
    display: flex;
    border: 1px solid #666;
  }

  .marks-table {
    flex: 1;
    border-collapse: collapse;
  }

  .marks-table th, .marks-table td {
    border: 1px solid #bbb;
    padding: 8px;
    text-align: left;
    font-size: 12px;
  }

  .marks-table th {
    background: #f7f7f7;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 11px;
    color: #555;
    letter-spacing: 0.5px;
  }

  .overall-col-header {
    width: 260px;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 11px;
    color: #555;
    background: #f7f7f7;
    text-align: center;
    padding: 12px;
    border: 1px solid #bbb;
  }

  .overall-content-container {
    width: 260px;
    display: flex;
    border-left: none;
  }

  .grade-circle-box {
    flex: 1.2;
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid #bbb;
    padding: 10px;
  }

  .grade-circle {
    width: 75px;
    height: 75px;
    border-radius: 50%;
    border: 1px solid #555;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    color: #333;
  }

  .grade-letter-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 52px;
    font-weight: 800;
    color: #222;
    text-align: center;
    padding: 8px;
  }

  /* Graph Analytics */
  .graph-section {
    margin-bottom: 12px;
  }

  .graph-header {
    border: 1px solid #000;
    padding: 0 12px;
    height: 30px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 0;
  }

  .graph-header h2 {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    line-height: 28px;
  }

  .graph-header .arrow-container {
    width: 32px;
    height: 32px;
    position: relative;
    border-left: 1px solid #000;
    margin-left: 15px;
  }

  .graphs-container {
    display: flex;
    gap: 20px;
    justify-content: center;
  }

  .graph-box {
    width: 300px;
    margin: 0 auto;
  }

  .graph-title {
    font-size: 15px;
    font-weight: 800;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #444;
  }

  .graph-canvas {
    width: 100% !important;
    height: 150px !important;
  }

  /* Remark Section */
  .remark-section {
    margin-bottom: 15px;
  }

  .remark-header {
    border: 1px solid #000;
    padding: 0 12px;
    height: 30px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
  }

  .remark-header h2 {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    line-height: 28px;
  }

  .remark-header .arrow-container {
    width: 32px;
    height: 32px;
    position: relative;
    border-left: 1px solid #000;
    margin-left: 15px;
  }

  .remark-inner {
    padding: 10px;
    border: 1px solid #eee;
    min-height: 50px;
    font-size: 12px;
    line-height: 1.6;
    color: #444;
    font-style: italic;
  }

  /* Footer */
  .footer {
    margin-top: 5px;
    text-align: center;
    padding-bottom: 5px;
  }

  .seal-box {
    width: 70px;
    height: 70px;
    margin: 0 auto 10px;
    border-radius: 50%;
    border: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    box-shadow: 0 0 0 3px #fff, 0 0 0 4px #333;
  }

  .footer-bar {
    border-top: 1px solid #000;
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: #444;
  }
</style>
</head>
<body>
<div class="page">
  <div class="school-name-box">
    <h1>${schoolName || 'TRISPHERE SCHOOL'}</h1>
  </div>

  <div class="report-header">
    <div class="report-title-main">Monthly Progress Report</div>
  </div>

  <div class="info-section">
    <div class="info-left">
      <div class="section-label">Student Information</div>
      <table class="info-table">
        <tr><td>Name:</td><td>${studentName}</td></tr>
        <tr><td>Class:</td><td>${className}</td></tr>
        <tr><td>Section:</td><td>${section || 'A'}</td></tr>
      </table>
    </div>
    <div class="info-right">
      <div class="student-name-display">${studentName}</div>
      <div class="student-sub-info">Grade ${className} - Section ${section || 'A'}</div>
      <div class="student-sub-info">Report Period: ${month} ${year}</div>
    </div>
  </div>

  <div class="performance-section">
    <div class="performance-header">
      <h2>Academic Performance</h2>
      <div class="arrow-container"><div class="arrow"></div></div>
    </div>
    
    <div style="display: flex; flex-direction: column;">
      <div style="display: flex;">
        <table class="marks-table" style="border-right:none;">
          <thead>
            <tr>
              <th>Subject</th>
              <th style="text-align: center">Obtained</th>
              <th style="text-align: center">Max Marks</th>
              <th style="text-align: center">Percentage</th>
              <th style="text-align: center">Grade</th>
            </tr>
          </thead>
        </table>
        <div class="overall-col-header">Overall</div>
      </div>
      
      <div class="perf-layout" style="border-top:none;">
        <table class="marks-table" style="border:none; margin:-1px;">
          <tbody>
            ${subjectScores.map(s => `
            <tr>
              <td>${s.subject}</td>
              <td style="text-align: center">${s.marks}</td>
              <td style="text-align: center">${s.total}</td>
              <td style="text-align: center; font-weight: 600">${Math.round((s.marks / s.total) * 100)}%</td>
              <td style="text-align: center; font-weight: 800">${getGrade(Math.round((s.marks / s.total) * 100))}</td>
            </tr>`).join('')}
            <tr style="background: #f9f9f9; font-weight: 800">
              <td>Total</td>
              <td style="text-align: center">${totalMarks}</td>
              <td style="text-align: center">${maxMarks}</td>
              <td style="text-align: center">${percentage}%</td>
              <td style="text-align: center">${grade}</td>
            </tr>
          </tbody>
        </table>
        <div class="overall-content-container">
          <div class="grade-circle-box">
            <div class="grade-circle">${percentage}%</div>
          </div>
          <div class="grade-letter-box">${grade}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="graph-section">
    <div class="graph-header">
      <h2>Academic Performance Analytics</h2>
      <div class="arrow-container"><div class="arrow"></div></div>
    </div>
    <div class="graphs-container">
      <div class="graph-box">
        <div class="graph-title">
          <span style="color:#3b82f6; font-style: normal; font-size: 18px; margin-right: 5px;">||</span> Attendance: ${attendancePercent}%
        </div>
        <canvas id="attendanceChart" class="graph-canvas"></canvas>
      </div>
      <div class="graph-box">
        <div class="graph-title">
          <span style="color:#ef4444; font-style: normal; font-size: 18px; margin-right: 5px;">||</span> Marks Trend (%)
        </div>
        <canvas id="marksTrendChart" class="graph-canvas"></canvas>
      </div>
      <div class="graph-box">
        <div class="graph-title">
          <span style="color:#10b981; font-style: normal; font-size: 18px; margin-right: 5px;">||</span> Class Comparison
        </div>
        <canvas id="comparisonChart" class="graph-canvas"></canvas>
      </div>
    </div>
  </div>

  <div class="remark-section">
    <div class="remark-header">
      <h2>Teacher's Remark</h2>
      <div class="arrow-container"><div class="arrow"></div></div>
    </div>
    <div class="remark-inner">
      ${aiRemark}
    </div>
  </div>

  <div class="footer">
    <div class="seal-box">
      ${trisphereLogo ? `<img src="${trisphereLogo}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">` : `
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#222" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#222" stroke-width="0.5"/>
        <path d="M50 25 L75 75 L25 75 Z" fill="none" stroke="#222" stroke-width="2"/>
        <circle cx="50" cy="50" r="10" fill="#222"/>
      </svg>`}
    </div>
    <div class="footer-bar">
      <span>www.yugnext-ai.com</span>
      <span>contact@yugnext-ai.com</span>
    </div>
  </div>
</div>

<script>
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 10;
  Chart.defaults.color = '#333';
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { font: { weight: 'bold' } }
      },
      y: { 
        beginAtZero: true,
        max: 100,
        ticks: { 
          stepSize: 25,
          callback: function(value) {
            if (value === 0) return '0';
            if (value === 45) return '45';
            if (value === 50) return '50';
            if (value === 75) return '75';
            if (value === 100) return '100';
            return value;
          }
        },
        grid: { color: '#f0f0f0' } 
      }
    }
  };

  try {
    const attData = ${attendanceChartData};
    const trendData = ${marksTrendData};
    const compData = ${comparisonData};

    // 1. Attendance Chart
    const ctxAtt = document.getElementById('attendanceChart').getContext('2d');
    new Chart(ctxAtt, {
      type: 'bar',
      data: {
        labels: attData.labels,
        datasets: [{
          data: attData.present,
          backgroundColor: '#3b82f6',
          barThickness: 12,
          borderRadius: 4
        }]
      },
      options: chartOptions
    });

    // 2. Marks Trend Chart
    const ctxTrend = document.getElementById('marksTrendChart').getContext('2d');
    new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: trendData.subjects.map(s => s.substring(0, 5) + '.'),
        datasets: [
          {
            label: 'Current',
            data: trendData.current,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3
          },
          {
            label: 'Previous',
            data: trendData.previous,
            borderColor: '#94a3b8',
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        ...chartOptions,
        plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 8 } } } }
      }
    });

    // 3. Class Comparison Chart
    const ctxComp = document.getElementById('comparisonChart').getContext('2d');
    new Chart(ctxComp, {
      type: 'bar',
      data: {
        labels: ['Student', 'Class Avg', 'Topper'],
        datasets: [{
          data: [compData.student, compData.classAvg, compData.topper],
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
          barThickness: 20
        }]
      },
      options: chartOptions
    });

  } catch (err) {
    console.error('Chart error:', err);
  }
</script>
</body>
</html>`;
}

/**
 * Convert percentage to grade.
 */
function getGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
}

/**
 * Generate a PDF buffer from student data.
 */
export async function generateStudentPDF(data, browserInstance = null) {
    // Pre-fetch profile photo and convert to Base64 to avoid Puppeteer network timeouts
    if (data.profilePhoto && data.profilePhoto.startsWith('http')) {
        console.log(`🖼️ Pre-fetching profile photo: ${data.profilePhoto.substring(0, 50)}...`);
        const base64 = await getBase64Image(data.profilePhoto);
        if (base64) {
            data.profilePhoto = base64;
            console.log('✅ Photo converted to Base64');
        } else {
            console.warn('⚠️ Could not convert photo to Base64, falling back to URL/Placeholder');
        }
    }

    // Load TriSphere logo as Base64 from local backend assets
    try {
        const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
        const logoBuffer = await fs.readFile(logoPath);
        data.trisphereLogo = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
        console.error('Failed to load TriSphere logo for report:', error.message);
    }

    const html = buildReportHTML(data);

    let browser = browserInstance;
    let shouldCloseBrowser = !browserInstance;
    let page = null;
    try {
        if (!browser) {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });
        }
        page = await browser.newPage();
        
        // Listen for console logs inside the page
        page.on('console', msg => console.log(`[Puppeteer Page] ${msg.type().toUpperCase()}: ${msg.text()}`));
        page.on('pageerror', err => console.error(`[Puppeteer Page Error] ${err.message}`));

        await page.setContent(html, { waitUntil: 'load', timeout: TIMEOUT_MS });

        // Wait for Chart.js to render all three canvases
        await page.waitForFunction(() => {
            const canvases = document.querySelectorAll('canvas');
            return canvases.length === 3;
        }, { timeout: 15000 });

        // Small delay to ensure chart animations complete
        await new Promise(resolve => setTimeout(resolve, 1500));

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', bottom: '0', left: '0', right: '0' }
        });

        return pdfBuffer;
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (pageErr) {
                console.error('Failed to close Puppeteer page:', pageErr.message);
            }
        }
        if (browser && shouldCloseBrowser) {
            try {
                await browser.close();
            } catch (browserErr) {
                console.error('Failed to close Puppeteer browser:', browserErr.message);
            }
        }
    }
}

export { getGrade };
