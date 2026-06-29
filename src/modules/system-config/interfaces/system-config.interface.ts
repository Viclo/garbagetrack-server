export interface ISystemConfig {
  id: number;
  key: string;
  value: string;
  updatedAt: Date;
}

export interface ISystemConfigKeys {
  NOTIFICATION_BLOCKS: 'notification_blocks';
}
