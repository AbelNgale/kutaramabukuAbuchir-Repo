import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import DOMPurify from 'dompurify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'img', 'hr', 'sub', 'sup', 's'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan', 'id'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover']
  });
}

export function stripHtml(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}
