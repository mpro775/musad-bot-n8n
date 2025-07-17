// types/evolution.types.ts
export interface StartSessionResponse {
  instanceId: string;
}

export interface QrResponse {
  qr: string;
}

export interface StatusResponse {
  state: string;
}

export interface SendMessageResponse {
  success: boolean;
  [key: string]: any;
}

export interface SetWebhookResponse {
  success: boolean;
  [key: string]: any;
}
