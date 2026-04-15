import type { QueueStatus, SenderProfile, SourceStatus } from '@shared/types';

export interface CheckDomainRequest {
  type: 'CHECK_DOMAIN';
  domain: string;
}

export interface AddDomainRequest {
  type: 'ADD_DOMAIN';
  domain: string;
}

export interface RemoveDomainRequest {
  type: 'REMOVE_DOMAIN';
  domain: string;
}

export interface CheckAllRequest {
  type: 'CHECK_ALL';
}

export interface DismissComplaintRequest {
  type: 'DISMISS_COMPLAINT';
  domain: string;
  complaintId: string;
}

export interface MarkDomainSeenRequest {
  type: 'MARK_DOMAIN_SEEN';
  domain: string;
}

export interface SaveComplaintNoteRequest {
  type: 'SAVE_COMPLAINT_NOTE';
  domain: string;
  complaintId: string;
  notes: string | null;
}

export interface VerifyLumenTokenRequest {
  type: 'VERIFY_LUMEN_TOKEN';
  token: string;
}

export interface SetLumenEnabledRequest {
  type: 'SET_LUMEN_ENABLED';
  enabled: boolean;
}

export interface GetQueueStatusRequest {
  type: 'GET_QUEUE_STATUS';
}

export interface GetSourceStatusRequest {
  type: 'GET_SOURCE_STATUS';
}

export interface PauseRequest {
  type: 'PAUSE';
  hours: number;
}

export interface ResumeRequest {
  type: 'RESUME';
}

export interface OpenSidepanelRequest {
  type: 'OPEN_SIDEPANEL';
}

export interface GetSenderProfileRequest {
  type: 'GET_SENDER_PROFILE';
  sender_name: string;
  forceRefresh?: boolean;
}

export interface CheckSenderSourceHealthRequest {
  type: 'CHECK_SENDER_SOURCE_HEALTH';
  sender_name: string;
}

export type RequestMessage =
  | CheckDomainRequest
  | AddDomainRequest
  | RemoveDomainRequest
  | CheckAllRequest
  | DismissComplaintRequest
  | MarkDomainSeenRequest
  | SaveComplaintNoteRequest
  | VerifyLumenTokenRequest
  | SetLumenEnabledRequest
  | GetQueueStatusRequest
  | GetSourceStatusRequest
  | PauseRequest
  | ResumeRequest
  | OpenSidepanelRequest
  | GetSenderProfileRequest
  | CheckSenderSourceHealthRequest;

export interface DomainActionResponse {
  ok: boolean;
  error?: string;
}

export interface VerifyTokenResponse {
  ok: boolean;
  status: SourceStatus;
  error?: string;
}

export interface QueueStatusResponse extends QueueStatus {}

export interface SourceStatusResponse {
  status: SourceStatus;
}

export interface SenderProfileResponse {
  profile: SenderProfile | null;
  queued: boolean;
  error?: string;
}

export type ResponseMap = {
  CHECK_DOMAIN: DomainActionResponse;
  ADD_DOMAIN: DomainActionResponse;
  REMOVE_DOMAIN: DomainActionResponse;
  CHECK_ALL: DomainActionResponse;
  DISMISS_COMPLAINT: DomainActionResponse;
  MARK_DOMAIN_SEEN: DomainActionResponse;
  SAVE_COMPLAINT_NOTE: DomainActionResponse;
  VERIFY_LUMEN_TOKEN: VerifyTokenResponse;
  SET_LUMEN_ENABLED: DomainActionResponse;
  GET_QUEUE_STATUS: QueueStatusResponse;
  GET_SOURCE_STATUS: SourceStatusResponse;
  PAUSE: DomainActionResponse;
  RESUME: DomainActionResponse;
  OPEN_SIDEPANEL: void;
  GET_SENDER_PROFILE: SenderProfileResponse;
  CHECK_SENDER_SOURCE_HEALTH: DomainActionResponse;
};

export function sendMessage<T extends RequestMessage>(
  message: T,
): Promise<ResponseMap[T['type']]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: ResponseMap[T['type']]) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}
