import mongoose, { Schema } from 'mongoose';

export interface IRegisteredBackend {
  url: string;
  enabled: boolean;
  priority: number;
  isPrimary: boolean;
}

export interface IBackendRegistryEvent {
  type: 'failover' | 'failback' | 'manual';
  fromUrl: string;
  toUrl: string;
  createdAt: Date;
}

export interface IBackendRegistry {
  _id: string;
  backends: IRegisteredBackend[];
  events: IBackendRegistryEvent[];
  updatedAt: Date;
}

const BackendRegistrySchema = new Schema<IBackendRegistry>(
  {
    _id: { type: String, default: 'backend-registry' },
    backends: [{
      _id: false,
      url: { type: String, required: true },
      enabled: { type: Boolean, default: true },
      priority: { type: Number, required: true },
      isPrimary: { type: Boolean, default: false },
    }],
    events: [{
      _id: false,
      type: { type: String, enum: ['failover', 'failback', 'manual'], required: true },
      fromUrl: { type: String, required: true },
      toUrl: { type: String, required: true },
      createdAt: { type: Date, required: true },
    }],
  },
  { timestamps: true },
);

export default mongoose.models.BackendRegistry
  || mongoose.model<IBackendRegistry>('BackendRegistry', BackendRegistrySchema);
