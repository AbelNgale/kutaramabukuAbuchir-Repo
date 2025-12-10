import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, IRunOptions, ImageRun } from 'docx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

interface ExportOptions {
  title: string;
  author?: string | null;
  content: string;
  coverElement?: HTMLElement | null;
  hasCoverPage?: boolean; // If true, skip title page as cover already has title/author
}

// Parse HTML content into structured elements
interface ParsedElement {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'list-item' | 'ordered-item';
  runs: ParsedRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  listLevel?: number;
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
      // Process children for other elements
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

export async function exportToDOCX(options: ExportOptions): Promise<void> {
  const { title, author, content, coverElement, hasCoverPage = true } = options;
  
  const parsedContent = parseHtmlContent(content);
  
  const children: Paragraph[] = [];
  
  // Add cover as image if available
  if (coverElement) {
    try {
      const canvas = await html2canvas(coverElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
      });
      
      const arrayBuffer = await blob.arrayBuffer();
      
      // Add cover image that fills the page (8.5in x 11in at 96 DPI = 816 x 1056 pixels)
      children.push(new Paragraph({
        children: [
          new ImageRun({
            data: arrayBuffer,
            transformation: {
              width: 612, // 8.5in in points (72 DPI)
              height: 792, // 11in in points (72 DPI)
            },
            type: 'png',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }));
      
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } catch (err) {
      console.error('Cover capture error for DOCX:', err);
    }
  }
  
  // Only add title page if no cover or explicitly requested
  if (!coverElement && !hasCoverPage) {
    children.push(new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 }
    }));
    
    if (author) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `por ${author}`, italics: true, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      }));
    }
    
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  
  // Content
  let listCounter = 0;
  
  parsedContent.forEach(element => {
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
      children.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }));
    } else if (element.type === 'heading2') {
      children.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }));
    } else if (element.type === 'heading3') {
      children.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }));
    } else if (element.type === 'list-item') {
      listCounter = 0;
      children.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        bullet: { level: element.listLevel || 0 },
        spacing: { after: 200 }
      }));
    } else if (element.type === 'ordered-item') {
      listCounter++;
      textRuns.unshift(new TextRun({ text: `${listCounter}. `, size: 24 }));
      children.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        spacing: { after: 200 }
      }));
    } else {
      children.push(new Paragraph({
        children: textRuns,
        alignment: getDocxAlignment(element.align),
        spacing: { after: 200 }
      }));
    }
  });
  
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children
    }]
  });
  
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
  
  // Only add title page if NO cover was added (cover already has title/author)
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
    
    // Set font based on element type
    let fontSize = 12;
    let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
    let spacingBefore = 0;
    let spacingAfter = 8;
    
    if (element.type === 'heading1') {
      fontSize = 24;
      fontStyle = 'bold';
      spacingBefore = 20;
      spacingAfter = 12;
    } else if (element.type === 'heading2') {
      fontSize = 18;
      fontStyle = 'bold';
      spacingBefore = 16;
      spacingAfter = 10;
    } else if (element.type === 'heading3') {
      fontSize = 14;
      fontStyle = 'bold';
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
    
    // Combine runs into text (jsPDF doesn't support mixed inline styles well, so we take the first style)
    const hasBold = element.runs.some(r => r.bold);
    const hasItalic = element.runs.some(r => r.italic);
    
    if (hasBold && hasItalic) fontStyle = 'bolditalic';
    else if (hasBold) fontStyle = 'bold';
    else if (hasItalic) fontStyle = 'italic';
    
    textContent += element.runs.map(r => r.text).join('');
    
    if (!textContent.trim()) {
      yPos += lineHeight;
      continue;
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
