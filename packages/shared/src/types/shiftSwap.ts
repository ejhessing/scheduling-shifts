// Shift Swap Types

export interface ShiftSwapRequest {
  swapId: string;
  requesterId: string;
  requesterName: string;
  targetUserId: string;
  targetUserName: string;
  shiftId: string;
  shiftDetails: {
    date: string;
    startTime: string;
    endTime: string;
    position: string;
    locationId: string;
  };
  status: ShiftSwapStatus;
  requestedAt: string;
  respondedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

export enum ShiftSwapStatus {
  PENDING_TARGET = 'PENDING_TARGET',
  PENDING_MANAGER = 'PENDING_MANAGER',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface ShiftSwapRequestBody {
  shiftId: string;
  targetUserId: string;
  notes?: string;
}

export interface ShiftSwapApprovalBody {
  swapId: string;
  action: 'approve' | 'reject';
  reason?: string;
}
