/**
 * Extract text from PDF file
 * Note: This is a client-side implementation for browser
 * For better results, consider using a backend service
 */

import Tesseract from 'tesseract.js';

/**
 * Extract text using OCR (for scanned or watermarked PDFs)
 */
const extractTextWithOCR = async (file) => {
  try {
    console.log('=== OCR EXTRACTION START ===');
    console.log('Converting PDF pages to images for OCR...');

    // Ensure PDF.js is loaded
    await loadPDFJS();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const numPages = Math.min(pdf.numPages, 20); // Limit to 20 pages for performance

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`OCR processing page ${pageNum}/${numPages}...`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      // Create canvas to render page
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      // Convert canvas to image and run OCR
      const imageData = canvas.toDataURL('image/png');
      const result = await Tesseract.recognize(imageData, 'eng', {
        logger: m => console.log(`OCR page ${pageNum}: ${m.status} ${Math.round(m.progress * 100)}%`)
      });

      fullText += result.data.text + '\n\n';
      console.log(`Page ${pageNum} OCR complete: ${result.data.text.length} characters`);
    }

    console.log('=== OCR EXTRACTION COMPLETE ===');
    console.log('Total OCR text length:', fullText.length);
    return fullText.trim();
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw error;
  }
};

/**
 * Native (non-OCR) text extraction via PDF.js. Instant and accurate for any
 * PDF with a real text layer (i.e. most modern textbook PDFs).
 */
const extractTextNative = async (file) => {
  console.log('=== NATIVE PDF EXTRACTION START ===');
  await loadPDFJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  const numPages = Math.min(pdf.numPages, 50); // generous cap — native is cheap
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  fullText = fullText.trim();
  console.log(`Native extraction: ${fullText.length} characters from ${numPages} pages`);
  return fullText;
};

/**
 * Read PDF file and extract text.
 *
 * Strategy: try the native PDF.js text layer first (instant, accurate). Only
 * fall back to Tesseract OCR if the native pass returned almost nothing —
 * that's the signature of a scanned/image-only PDF. Previously this function
 * forced OCR on every upload, which on a low-RAM machine can take minutes per
 * page and frequently returns garbled text on complex layouts. That broke the
 * entire AI pipeline (no usable text → no notes → no quiz → no YouTube).
 *
 * @param {File} file - PDF file object
 * @returns {Promise<string>} Extracted text
 */
export const extractTextFromPDF = async (file) => {
  try {
    const native = await extractTextNative(file);
    // Heuristic: a real chapter PDF has thousands of characters per page.
    // <200 chars total = either an image-only scan or a parser failure.
    if (native && native.length > 200) {
      return native;
    }
    console.warn(`Native extraction yielded only ${native.length} chars — falling back to OCR.`);
  } catch (err) {
    console.warn('Native extraction failed, falling back to OCR:', err);
  }
  return await extractTextWithOCR(file);
};

/**
 * Load PDF.js library
 */
const loadPDFJS = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

/**
 * Simple text extraction for small PDFs (fallback method)
 */
/**
 * Extract text from PDF URL
 * @param {string} url - PDF URL
 * @returns {Promise<string>}
 */
export const extractTextFromURL = async (url) => {
  try {
    console.log('Fetching PDF from URL:', url);
    
    // Ensure PDF.js is loaded
    await loadPDFJS();
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    // Use PDF.js for text extraction
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const numPages = Math.min(pdf.numPages, 20); // Limit pages
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from URL:', error);
    return '';
  }
};


