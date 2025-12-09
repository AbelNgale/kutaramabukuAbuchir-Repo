export { ClassicTemplate } from './ClassicTemplate';
export { VisualTemplate } from './VisualTemplate';
export { MinimalTemplate } from './MinimalTemplate';

export interface EbookTemplateProps {
  title: string;
  content: string;
  images?: { src: string; alt: string; caption?: string }[];
}

export const EBOOK_TEMPLATES = [
  {
    id: 'classic',
    name: 'Clássico',
    description: 'Layout tradicional com texto corrido e imagens centralizadas',
    component: 'ClassicTemplate',
  },
  {
    id: 'visual',
    name: 'Visual',
    description: 'Blocos alternados com imagens grandes e impactantes',
    component: 'VisualTemplate',
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Design moderno com texto e imagens em colunas',
    component: 'MinimalTemplate',
  },
  {
    id: 'modern',
    name: 'Moderno',
    description: 'Visual contemporâneo com gradientes e estilo sofisticado',
    component: 'ModernTemplate',
  },
  {
    id: 'bold',
    name: 'Impactante',
    description: 'Cores vibrantes e tipografia forte para destaque',
    component: 'BoldTemplate',
  },
  {
    id: 'elegant',
    name: 'Elegante',
    description: 'Design refinado com bordas decorativas e fontes serifadas',
    component: 'ElegantTemplate',
  },
] as const;
