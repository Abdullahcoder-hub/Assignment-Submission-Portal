export interface PasswordValidationResult {
  isValid: boolean;
  message?: string;
}

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }

  const hasUppercase = /[A-Z]/.test(password);
  if (!hasUppercase) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }

  const hasLowercase = /[a-z]/.test(password);
  if (!hasLowercase) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }

  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    return { isValid: false, message: 'Password must contain at least one number (0-9).' };
  }

  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  if (!hasSpecialChar) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&* etc).' };
  }

  return { isValid: true };
};
