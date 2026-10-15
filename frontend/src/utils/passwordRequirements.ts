export const getPasswordRequirementStatus = (password: string) => [
  { label: 'At least 8 characters', isMet: password.length >= 8 },
  { label: 'Uppercase letter (A-Z)', isMet: /[A-Z]/.test(password) },
  { label: 'Lowercase letter (a-z)', isMet: /[a-z]/.test(password) },
  { label: 'Number (0-9)', isMet: /[0-9]/.test(password) },
  { label: 'Special character (!@#$%^&* etc.)', isMet: /[^A-Za-z0-9]/.test(password) },
];
