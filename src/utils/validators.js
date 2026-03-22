/**
 * Validate an email address format.
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate that a string meets minimum length.
 */
export function isMinLength(str, min = 1) {
  return typeof str === 'string' && str.trim().length >= min;
}

/**
 * Validate contact form fields.
 * Returns an object with field-level errors.
 */
export function validateContactForm({ name, email, message }) {
  const errors = {};

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
