import { sanitizeHtml } from '@/lib/utils';

interface RichTextViewerProps {
  html: string;
  className?: string;
}

/**
 * Componente para renderizar HTML rico de forma segura e consistente
 * Usa a mesma base de estilos que o editor CKEditor
 */
export default function RichTextViewer({ html, className = '' }: RichTextViewerProps) {
  const sanitizedHtml = sanitizeHtml(html);

  return (
    <div 
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
