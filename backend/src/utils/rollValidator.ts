export interface RollValidationResult {
  isValid: boolean;
  message?: string;
}

export const validateRollNumber = (rollNumber: string): RollValidationResult => {
  if (!rollNumber || typeof rollNumber !== 'string') {
    return { isValid: false, message: 'Roll number is required.' };
  }

  const clean = rollNumber.trim();
  if (!/^\d{7}$/.test(clean)) {
    return {
      isValid: false,
      message: 'Roll number must be exactly 7 digits (e.g. 2260000).',
    };
  }

  return { isValid: true };
};
