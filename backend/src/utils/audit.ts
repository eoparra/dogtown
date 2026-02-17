import { prisma } from '../index.js';

export async function logAuditEvent(params: {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null
      }
    });
  } catch (error) {
    // Log but don't fail the request if audit logging fails
    console.error('Audit log failed:', error);
  }
}
