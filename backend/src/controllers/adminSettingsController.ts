import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getOrCreateClassJoinCode, regenerateClassJoinCode, updateClassJoinCode } from '../utils/joinCode.js';

export const getJoinCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getOrCreateClassJoinCode();
    res.status(200).json({
      success: true,
      joinCode: settings.joinCode,
      isJoinCodeActive: settings.isJoinCodeActive,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch class join code.' });
  }
};

export const updateJoinCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customCode } = req.body;
    if (!customCode || !customCode.trim()) {
      res.status(400).json({ success: false, message: 'Please provide a valid join code.' });
      return;
    }

    const updatedCode = await updateClassJoinCode(customCode);
    res.status(200).json({
      success: true,
      message: 'Class join code updated successfully.',
      joinCode: updatedCode,
      isJoinCodeActive: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update class join code.' });
  }
};

export const regenerateCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const newCode = await regenerateClassJoinCode();
    res.status(200).json({
      success: true,
      message: 'Class join code regenerated successfully.',
      joinCode: newCode,
      isJoinCodeActive: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to regenerate class join code.' });
  }
};

export const toggleCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await getOrCreateClassJoinCode();
    settings.isJoinCodeActive = !settings.isJoinCodeActive;
    await settings.save();

    res.status(200).json({
      success: true,
      message: `Class join code ${settings.isJoinCodeActive ? 'enabled' : 'disabled'} successfully.`,
      joinCode: settings.joinCode,
      isJoinCodeActive: settings.isJoinCodeActive,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle class join code.' });
  }
};
