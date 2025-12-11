import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, IRunOptions, ImageRun, SectionType } from 'docx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

interface ExportOptions {
  title: string;
  author?: string | null;
  content: string;
  coverElement?: HTMLElement | null;
  hasCoverPage?: boolean;
}

interface ParsedElement {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'list-item' | 'ordered-item' | 'image';
  runs: ParsedRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  listLevel?: number;
  imageSrc?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface ParsedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function parseHtmlContent(html: string): ParsedElement[] {
  const container = document.createElement('div');
  container.innerHTML = html;
  
  const elements: ParsedElement[] = [];
  
  function getAlignment(el: Element): 'left' | 'center' | 'right' | 'justify' | undefined {
    const style = (el as HTMLElement).style?.textAlign;
    const className = el.className || '';
    
    if (style === 'center' || className.includes('text-center')) return 'center';
    if (style === 'right' || className.includes('text-right')) return 'right';
    if (style === 'justify' || className.includes('text-justify')) return 'justify';
    return 'left';
  }
  
  function parseInlineContent(node: Node): ParsedRun[] {
    const runs: ParsedRun[] = [];
    
    function processNode(n: Node, styles: { bold?: boolean; italic?: boolean; underline?: boolean } = {}) {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent || '';
        if (text.trim() || text.includes(' ')) {
          runs.push({ text, ...styles });
        }
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        const tagName = el.tagName.toLowerCase();
        
        // Skip images in inline content
        if (tagName === 'img') return;
        
        const newStyles = { ...styles };
        if (tagName === 'strong' || tagName === 'b') newStyles.bold = true;
        if (tagName === 'em' || tagName === 'i') newStyles.italic = true;
        if (tagName === 'u') newStyles.underline = true;
        
        el.childNodes.forEach(child => processNode(child, newStyles));
      }
    }
    
    node.childNodes.forEach(child => processNode(child));
    return runs;
  }
  
  function processElement(el: Element, listLevel = 0) {
    const tagName = el.tagName.toLowerCase();
    
    // Handle images
    if (tagName === 'img') {
      const src = (el as HTMLImageElement).src;
      const width = (el as HTMLImageElement).width || 400;
      const height = (el as HTMLImageElement).height || 300;
      if (src) {
        elements.push({
          type: 'image',
          runs: [],
          imageSrc: src,
          imageWidth: width,
          imageHeight: height,
          align: 'center'
        });
      }
      return;
    }
    
    // Check for images inside figures
    if (tagName === 'figure') {
      const img = el.querySelector('img');
      if (img) {
        processElement(img);
      }
      return;
    }
    
    if (tagName === 'h1') {
      elements.push({
        type: 'heading1',
        runs: parseInlineContent(el),
        align: getAlignment(el)
      });
    } else if (tagName === 'h2') {
      elements.push({
        type: 'heading2',
        runs: parseInlineContent(el),
        align: getAlignment(el)
      });
    } else if (tagName === 'h3') {
      elements.push({
        type: 'heading3',
        runs: parseInlineContent(el),
        align: getAlignment(el)
      });
    } else if (tagName === 'p' || tagName === 'div') {
      // Check for images inside paragraphs
      const img = el.querySelector('img');
      if (img) {
        processElement(img);
      }
      
      const runs = parseInlineContent(el);
      if (runs.length > 0 && runs.some(r => r.text.trim())) {
        elements.push({
          type: 'paragraph',
          runs,
          align: getAlignment(el)
        });
      }
    } else if (tagName === 'ul') {
      el.querySelectorAll(':scope > li').forEach(li => {
        elements.push({
          type: 'list-item',
          runs: parseInlineContent(li),
          listLevel
        });
      });
    } else if (tagName === 'ol') {
      el.querySelectorAll(':scope > li').forEach(li => {
        elements.push({
          type: 'ordered-item',
          runs: parseInlineContent(li),
          listLevel
        });
      });
    } else if (tagName === 'br') {
      elements.push({
        type: 'paragraph',
        runs: [{ text: '' }]
      });
    } else {
      el.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          processElement(child as Element, listLevel);
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text) {
            elements.push({
              type: 'paragraph',
              runs: [{ text }]
            });
          }
        }
      });
    }
  }
  
  container.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      processElement(node as Element);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        elements.push({
          type: 'paragraph',
          runs: [{ text }]
        });
      }
    }
  });
  
  return elements;
}

function getDocxAlignment(align?: string): typeof AlignmentType[keyof typeof AlignmentType] {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
}

async function fetchImageAsArrayBuffer(src: string): Promise<ArrayBuffer | null> {
  try {
    // For external images, try to fetch with CORS
    const response = await fetch(src, { mode: 'cors' });
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch {
    // If CORS fails, try using a canvas approach
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              blob.arrayBuffer().then(resolve);
            } else {
              resolve(null);
            }
          }, 'image/png');
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    } catch {
      return null;
    }
  }
  return null;
}

export async function exportToDOCX(options: ExportOptions): Promise<void> {
  const { title, author, content, coverElement, hasCoverPage = true } = options;
  
  const parsedContent = parseHtmlContent(content);
  
  const sections: any[] = [];
  
  // Add cover as first section (full page, no margins)
  if (coverElement) {
    try {
      const canvas = await html2canvas(coverElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
      });
      
      const arrayBuffer = await blob.arrayBuffer();
      
      // Cover section with zero margins - A4 dimensions in points (595x842)
      sections.push({
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            size: { width: 11906, height: 16838 } // A4 in twips (1/20 of a point)
          }
        },
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                data: arrayBuffer,
                transformation: {
                  width: 595, // A4 width in points
                  height: 842, // A4 height in points
                },
                type: 'png',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 }
          })
        ]
      });
    } catch (err) {
      console.error('Cover capture error for DOCX:', err);
    }
  }
  
  // Content section with normal margins
  const contentChildren: Paragraph[] = [];
  
  // Only add title page if no cover
  if (!coverElement && !hasCoverPage) {
    contentChildren.push(new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 }
    }));
    
    if (author) {
      contentChildren.push(new Paragraph({
        children: [new TextRun({ text: `por ${author}`, italics: true, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      }));
    }
    
    contentChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }
  
  // Content
  let listCounter = 0;
  
  for (const element of parsedContent) {
    // Handle images
    if (element.type === 'image' && element.imageSrc) {
      const imageBuffer = await fetchImageAsArrayBuffer(element.imageSrc);
      if (imageBuffer) {
        const maxWidth = 450;
        const maxHeight = 400;
        let width = element.imageWidth || 400;
        let height = element.imageHeight || 300;
        
        // Scale image to fit
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        contentChildren.push(new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: { width, height },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 }
        }));
      }
      continue;
    }
    
    const textRuns = element.runs.map(run => {
      const runOptions: IRunOptions = {
        text: run.text,
        bold: run.bold,
        italics: run.italic,
        underline: run.underline ? {} : undefined,
        size: element.type === 'heading1' ? 48 : element.type === 'heading2' ? 36 : element.type === 'heading3' ? 28 : 24
      };
      return new TextRun(runOptions);
    });
    
    if (element.type === 'heading1') {
      contentChildren.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }));
    } else if (element.type === 'heading2') {
      contentChildren.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }));
    } else if (element.type === 'heading3') {
      contentChildren.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }));
    } else if (element.type === 'list-item') {
      listCounter = 0;
      contentChildren.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        bullet: { level: element.listLevel || 0 },
        spacing: { after: 200 }
      }));
    } else if (element.type === 'ordered-item') {
      listCounter++;
      textRuns.unshift(new TextRun({ text: `${listCounter}. `, size: 24 }));
      contentChildren.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        spacing: { after: 200 }
      }));
    } else {
      contentChildren.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        spacing: { after: 200 }
      }));
    }
  }
  
  sections.push({
    properties: {
      type: sections.length > 0 ? SectionType.NEXT_PAGE : SectionType.CONTINUOUS,
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: contentChildren
  });
  
  const doc = new Document({ sections });
  
  const blob = await Packer.toBlob(doc);
  const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').trim() || 'ebook';
  saveAs(blob, `${safeTitle}.docx`);
}

export async function exportToPDF(options: ExportOptions): Promise<void> {
  const { title, author, content, coverElement, hasCoverPage = true } = options;
  
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 72;
  const contentWidth = pageWidth - (margin * 2);
  const lineHeight = 18;
  const maxY = pageHeight - margin;
  
  let hasCover = false;
  
  // Add cover if available
  if (coverElement) {
    try {
      const canvas = await html2canvas(coverElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);
      hasCover = true;
      pdf.addPage();
    } catch (err) {
      console.error('Cover capture error:', err);
    }
  }
  
  // Only add title page if NO cover was added
  let yPos = margin;
  
  if (!hasCover) {
    yPos = margin + 150;
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(title, contentWidth);
    pdf.text(titleLines, pageWidth / 2, yPos, { align: 'center' });
    yPos += titleLines.length * 35 + 50;
    
    if (author) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`por ${author}`, pageWidth / 2, yPos, { align: 'center' });
    }
    
    pdf.addPage();
    yPos = margin;
  }
  
  // Parse and render content
  const parsedContent = parseHtmlContent(content);
  let listCounter = 0;
  
  for (const element of parsedContent) {
    // Check if we need a new page
    if (yPos > maxY - 40) {
      pdf.addPage();
      yPos = margin;
    }
    
    // Handle images
    if (element.type === 'image' && element.imageSrc) {
      try {
        // Try to load the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = element.imageSrc!;
        });
        
        const maxWidth = contentWidth;
        const maxHeight = 300;
        let width = element.imageWidth || img.width || 400;
        let height = element.imageHeight || img.height || 300;
        
        // Scale to fit
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        // Check if need new page for image
        if (yPos + height > maxY) {
          pdf.addPage();
          yPos = margin;
        }
        
        const xPos = margin + (contentWidth - width) / 2;
        
        // Create canvas to draw image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xPos, yPos, width, height);
        yPos += height + 20;
      } catch {
        console.warn('Could not load image for PDF:', element.imageSrc);
      }
      continue;
    }
    
    // Set font based on element type
    let fontSize = 12;
    let spacingBefore = 0;
    let spacingAfter = 8;
    
    if (element.type === 'heading1') {
      fontSize = 24;
      spacingBefore = 20;
      spacingAfter = 12;
    } else if (element.type === 'heading2') {
      fontSize = 18;
      spacingBefore = 16;
      spacingAfter = 10;
    } else if (element.type === 'heading3') {
      fontSize = 14;
      spacingBefore = 12;
      spacingAfter = 8;
    } else if (element.type === 'list-item') {
      listCounter = 0;
    } else if (element.type === 'ordered-item') {
      listCounter++;
    }
    
    yPos += spacingBefore;
    
    // Build text content
    let xPos = margin;
    let textContent = '';
    
    if (element.type === 'list-item') {
      textContent = '• ';
      xPos = margin + 20;
    } else if (element.type === 'ordered-item') {
      textContent = `${listCounter}. `;
      xPos = margin + 20;
    }
    
    // Process each run with its own style
    const fullText = element.runs.map(r => r.text).join('');
    textContent += fullText;
    
    if (!textContent.trim()) {
      yPos += lineHeight;
      continue;
    }
    
    // Determine font style - apply bold only to headings, not body text
    let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
    
    if (element.type.startsWith('heading')) {
      fontStyle = 'bold';
    } else {
      // For regular paragraphs, check if ALL runs are bold (not just any)
      const allBold = element.runs.length > 0 && element.runs.every(r => r.bold);
      const allItalic = element.runs.length > 0 && element.runs.every(r => r.italic);
      
      if (allBold && allItalic) fontStyle = 'bolditalic';
      else if (allBold) fontStyle = 'bold';
      else if (allItalic) fontStyle = 'italic';
    }
    
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    
    // Get alignment
    let align: 'left' | 'center' | 'right' | 'justify' = 'left';
    if (element.align === 'center') align = 'center';
    else if (element.align === 'right') align = 'right';
    else if (element.align === 'justify') align = 'justify';
    
    // Calculate x position based on alignment
    let textX = xPos;
    if (align === 'center') textX = pageWidth / 2;
    else if (align === 'right') textX = pageWidth - margin;
    
    // Split text into lines that fit the content width
    const effectiveWidth = element.type.includes('item') ? contentWidth - 20 : contentWidth;
    const lines = pdf.splitTextToSize(textContent, effectiveWidth);
    
    for (const line of lines) {
      if (yPos > maxY) {
        pdf.addPage();
        yPos = margin;
      }
      
      pdf.text(line, textX, yPos, { align: align === 'justify' ? 'left' : align });
      yPos += lineHeight;
    }
    
    yPos += spacingAfter;
  }
  
  const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').trim() || 'ebook';
  pdf.save(`${safeTitle}.pdf`);
}
