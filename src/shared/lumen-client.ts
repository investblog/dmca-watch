import type { Complaint, SenderProfile, SourceStatus } from './types';

export class LumenNotImplementedError extends Error {
  constructor(message = 'Lumen client is not implemented until a real tokened search.json response is validated.') {
    super(message);
    this.name = 'LumenNotImplementedError';
  }
}

export function isLumenNotImplementedError(error: unknown): error is LumenNotImplementedError {
  return error instanceof LumenNotImplementedError;
}

export class LumenAuthError extends Error {
  readonly httpStatus: number;
  constructor(httpStatus: number, message = 'Lumen API rejected the token.') {
    super(message);
    this.name = 'LumenAuthError';
    this.httpStatus = httpStatus;
  }
}

export function isLumenAuthError(error: unknown): error is LumenAuthError {
  return error instanceof LumenAuthError;
}

export interface VerifyLumenTokenResult {
  ok: boolean;
  status: SourceStatus;
  error?: string;
}

export async function verifyLumenToken(_token: string): Promise<VerifyLumenTokenResult> {
  throw new LumenNotImplementedError();
}

export async function searchLumenComplaintsByDomain(
  _domain: string,
  _token: string,
): Promise<Complaint[]> {
  throw new LumenNotImplementedError();
}

export type LumenSenderProfileAggregates = Omit<
  SenderProfile,
  'sender_name' | 'source' | 'fetched_at' | 'status' | 'error' | 'source_health' | 'cross_watchlist'
>;

export async function fetchLumenSenderProfile(
  _senderName: string,
  _token: string,
): Promise<LumenSenderProfileAggregates> {
  throw new LumenNotImplementedError();
}
