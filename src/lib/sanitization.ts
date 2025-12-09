/**
 * Utilitários de sanitização de texto
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalized: string;
}

/**
 * Remove espaços extras e caracteres especiais perigosos
 */
export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '');
};

/**
 * Validar e normalizar título
 */
export const validateAndNormalizeTitle = (
  title: string,
  maxLength: number = 200
): ValidationResult => {
  const normalized = sanitizeText(title);

  if (!normalized || normalized.length === 0) {
    return {
      isValid: false,
      error: 'Título não pode estar vazio',
      normalized: '',
    };
  }

  if (normalized.length < 3) {
    return {
      isValid: false,
      error: 'Título deve ter pelo menos 3 caracteres',
      normalized,
    };
  }

  if (normalized.length > maxLength) {
    return {
      isValid: false,
      error: `Título deve ter no máximo ${maxLength} caracteres`,
      normalized,
    };
  }

  return {
    isValid: true,
    normalized,
  };
};

/**
 * Validar e normalizar conteúdo HTML
 */
export const validateAndNormalizeContent = (
  content: string,
  maxLength: number = 100000
): ValidationResult => {
  const normalized = content.trim();

  if (!normalized || normalized.length === 0) {
    return {
      isValid: false,
      error: 'Conteúdo não pode estar vazio',
      normalized: '',
    };
  }

  if (normalized.length > maxLength) {
    return {
      isValid: false,
      error: `Conteúdo excede o limite de ${maxLength} caracteres`,
      normalized,
    };
  }

  return {
    isValid: true,
    normalized,
  };
};
