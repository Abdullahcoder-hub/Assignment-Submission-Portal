import ClassSettings, { IClassSettings } from '../models/ClassSettings.js';
import crypto from 'node:crypto';

/**
 * Gets or initializes the class join code settings
 */
export const getOrCreateClassJoinCode = async (): Promise<IClassSettings> => {
  let settings = await ClassSettings.findOne();
  const generateJoinCode = () => `CLASS-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  if (!settings) {
    const configuredCode = process.env.CLASS_JOIN_CODE?.trim();
    settings = await ClassSettings.create({
      joinCode: configuredCode && configuredCode.toUpperCase() !== 'CLASS-2026-PORTAL'
        ? configuredCode
        : generateJoinCode(),
      isJoinCodeActive: true,
    });
  }
  return settings;
};

/**
 * Verifies if the provided join code matches the active class join code
 */
export const verifyClassJoinCode = async (inputCode: string): Promise<boolean> => {
  if (!inputCode || !inputCode.trim()) return false;
  const settings = await getOrCreateClassJoinCode();
  if (!settings.isJoinCodeActive) return false;
  return settings.joinCode.trim().toUpperCase() === inputCode.trim().toUpperCase();
};

/**
 * Regenerate a new random Class Join Code
 */
export const regenerateClassJoinCode = async (): Promise<string> => {
  const newCode = `CLASS-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  let settings = await ClassSettings.findOne();
  if (settings) {
    settings.joinCode = newCode;
    settings.isJoinCodeActive = true;
    await settings.save();
  } else {
    settings = await ClassSettings.create({
      joinCode: newCode,
      isJoinCodeActive: true,
    });
  }

  return newCode;
};

/**
 * Update Class Join Code with a custom code edited by CR
 */
export const updateClassJoinCode = async (customCode: string): Promise<string> => {
  const cleanCode = customCode.trim().toUpperCase();
  let settings = await ClassSettings.findOne();
  if (settings) {
    settings.joinCode = cleanCode;
    settings.isJoinCodeActive = true;
    await settings.save();
  } else {
    settings = await ClassSettings.create({
      joinCode: cleanCode,
      isJoinCodeActive: true,
    });
  }
  return cleanCode;
};

