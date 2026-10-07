import Class, { IClass } from '../models/Class.js';
import ClassSettings, { IClassSettings } from '../models/ClassSettings.js';
import crypto from 'node:crypto';

export const generateRandomJoinCode = (): string => {
  return `CLASS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

/**
 * Gets or initializes the default class join code settings (legacy compatibility)
 */
export const getOrCreateClassJoinCode = async (): Promise<IClassSettings> => {
  let settings = await ClassSettings.findOne();
  if (!settings) {
    const configuredCode = process.env.CLASS_JOIN_CODE?.trim();
    settings = await ClassSettings.create({
      joinCode: configuredCode && configuredCode.toUpperCase() !== 'CLASS-2026-PORTAL'
        ? configuredCode
        : generateRandomJoinCode(),
      isJoinCodeActive: true,
    });
  }
  return settings;
};

/**
 * Verifies if the provided join code matches any active Class
 * Returns the matching Class document or null
 */
export const findAndVerifyClassByJoinCode = async (inputCode: string): Promise<IClass | null> => {
  if (!inputCode || !inputCode.trim()) return null;
  const cleanCode = inputCode.trim().toUpperCase();

  // 1. Check Class model
  let classDoc = await Class.findOne({ joinCode: cleanCode, isJoinCodeActive: true, isActive: true });
  if (classDoc) return classDoc;

  // 2. Legacy fallback to ClassSettings
  const legacySettings = await ClassSettings.findOne({ joinCode: cleanCode, isJoinCodeActive: true });
  if (legacySettings) {
    // Find or create default class for legacy support
    let defaultClass = await Class.findOne({ semester: '5th', section: 'A' });
    if (!defaultClass) {
      defaultClass = await Class.create({
        name: '5th A',
        semester: '5th',
        section: 'A',
        joinCode: cleanCode,
        isJoinCodeActive: true,
        isActive: true,
      });
    }
    return defaultClass;
  }

  return null;
};

/**
 * Verifies if the provided join code matches any active Class or settings
 */
export const verifyClassJoinCode = async (inputCode: string): Promise<boolean> => {
  const matchedClass = await findAndVerifyClassByJoinCode(inputCode);
  return Boolean(matchedClass);
};

/**
 * Regenerate a new random Class Join Code for legacy settings
 */
export const regenerateClassJoinCode = async (): Promise<string> => {
  const newCode = generateRandomJoinCode();

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
 * Update Class Join Code with a custom code
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
