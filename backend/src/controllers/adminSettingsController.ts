import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getOrCreateClassJoinCode, regenerateClassJoinCode, updateClassJoinCode } from '../utils/joinCode.js';
import Admin from '../models/Admin.js';
import { IRegisteredBackend } from '../models/BackendRegistry.js';
import {
  loadBackendRegistry,
  normalizeBackendUrl,
  recordBackendEvent,
  saveBackendList,
  validateBackendList,
} from '../utils/backendRegistry.js';

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

export const getAdmins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admins = await Admin.find({}).select('name email _id').lean();
    res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admins.' });
  }
};

export const getBackendConfiguration = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, ...(await loadBackendRegistry()) });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to load backend configuration.' });
  }
};

export const updateBackendConfiguration = async (req: AuthRequest, res: Response): Promise<void> => {
  let backends: IRegisteredBackend[];
  try {
    backends = validateBackendList(req.body?.backends);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Invalid backend configuration.',
    });
    return;
  }

  try {
    const savedBackends = await saveBackendList(backends);
    res.status(200).json({
      success: true,
      message: 'Backend configuration saved.',
      ...(await loadBackendRegistry()),
      backends: savedBackends,
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to save backend configuration.' });
  }
};

export const recordBackendConfigurationEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const allowedTypes = ['failover', 'failback', 'manual'] as const;
  const { type, fromUrl, toUrl } = req.body || {};
  const isAllowedType = (value: unknown): value is typeof allowedTypes[number] =>
    typeof value === 'string' && allowedTypes.some((allowedType) => allowedType === value);
  if (!isAllowedType(type)) {
    res.status(400).json({ success: false, message: 'Invalid backend event type.' });
    return;
  }

  let normalizedFrom: string;
  let normalizedTo: string;
  try {
    normalizedFrom = fromUrl ? normalizeBackendUrl(fromUrl) : '';
    normalizedTo = normalizeBackendUrl(toUrl);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Invalid backend event.',
    });
    return;
  }

  try {
    const { backends } = await loadBackendRegistry();
    const configuredBackends: IRegisteredBackend[] = backends;
    if (!configuredBackends.some((backend) => backend.enabled && backend.url === normalizedTo)) {
      res.status(400).json({ success: false, message: 'The selected backend is not enabled.' });
      return;
    }
    await recordBackendEvent({ type, fromUrl: normalizedFrom, toUrl: normalizedTo });
    res.status(201).json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to record backend event.' });
  }
};
