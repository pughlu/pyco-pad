export interface IWidgetConfig {
  isReadOnly: boolean;
  runMode: 'attempt' | 'edit' | 'grade' | 'review';
  defaultCellType?: string;
  disableInsertAll?: boolean;
  [key: string]: unknown;
}

export interface LoadContentMessage {
  type: 'LOAD_CONTENT';
  payload: {
    content?: string;
    config?: IWidgetConfig;
  };
}

export interface SyncAckMessage {
  type: 'SYNC_ACK';
  payload?: any;
}

export interface InsertContentMessage {
  type: 'INSERT_CONTENT';
  payload: {
    content: string;
  };
}

export interface ErrorLockdownMessage {
  type: 'ERROR_LOCKDOWN';
  payload?: any;
}

export type HostMessage =
  | LoadContentMessage
  | SyncAckMessage
  | InsertContentMessage
  | ErrorLockdownMessage;
