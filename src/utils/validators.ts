/**
 * Validate an email address format.
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate that a string meets minimum length.
 */
export function isMinLength(str: unknown, min = 1): boolean {
  return typeof str === 'string' && str.trim().length >= min;
}

/**
 * Validate contact form fields.
 * Returns an object with field-level errors.
 */
export interface ContactFormFields {
  name: string;
  email: string;
  message: string;
}

export type ContactFormErrors = Partial<Record<keyof ContactFormFields, string>>;

export function validateContactForm({ name, email, message }: Partial<ContactFormFields>): {
  isValid: boolean;
  errors: ContactFormErrors;
} {
  const errors: ContactFormErrors = {};

  if (!isMinLength(name, 2)) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!isMinLength(message, 10)) {
    errors.message = 'Message must be at least 10 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
