import ClassSettings, { IClassSettings } from '../models/ClassSettings.js';

/**
 * Gets or initializes the class join code settings
 */
export const getOrCreateClassJoinCode = async (): Promise<IClassSettings> => {
  let settings = await ClassSettings.findOne();
  if (!settings) {
    settings = await ClassSettings.create({
      joinCode: process.env.CLASS_JOIN_CODE || 'CLASS-2026-PORTAL',
      isJoinCodeActive: true,
    });
    console.log(`[ClassSettings] Initialized default Class Join Code: ${settings.joinCode}`);
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
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newCode = `CLASS-2026-${randomSuffix}`;

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

