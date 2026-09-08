import { BillingRepository } from '../database/repositories/BillingRepository.js';
import { AuditRepository } from '../database/repositories/AuditRepository.js';
import { StudentRepository } from '../database/repositories/StudentRepository.js';
import { SessionUser } from '../../shared/types.js';
import {
  InvoiceDto,
  PaymentDto,
  CreateInvoiceInput,
  RecordPaymentInput,
  StudentFeeSummaryDto,
} from '../../shared/types.js';

function verifyPermission(user: SessionUser, permission: string): void {
  if (user.role === 'super_admin' || user.permissions.includes('*')) {
    return;
  }
  if (!user.permissions.includes(permission)) {
    throw new Error(`FORBIDDEN: User lacks required permission '${permission}'.`);
  }
}

export class BillingService {
  static async getInvoices(
    user: SessionUser,
    params: {
      studentId?: string;
      billingCycle?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ data: InvoiceDto[]; total: number }> {
    return BillingRepository.getInvoices(params);
  }

  static async createInvoice(
    user: SessionUser,
    input: CreateInvoiceInput
  ): Promise<InvoiceDto> {
    verifyPermission(user, 'billing:run');

    const student = await StudentRepository.findById(input.studentId);
    if (!student) {
      throw new Error(`STUDENT_NOT_FOUND: Student '${input.studentId}' not found.`);
    }

    if (input.amountDue <= 0) {
      throw new Error('INVALID_AMOUNT: Invoice amount due must be strictly positive.');
    }

    const created = await BillingRepository.createInvoice(input);

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'INVOICE_CREATED',
      entityType: 'invoices',
      entityId: created.id,
      changesSummary: {
        studentId: input.studentId,
        billingCycle: input.billingCycle,
        amountDue: input.amountDue,
      },
    });

    const refreshed = await BillingRepository.getInvoices({ studentId: input.studentId, limit: 1 });
    return refreshed.data[0];
  }

  static async recordPayment(
    user: SessionUser,
    input: RecordPaymentInput
  ): Promise<PaymentDto> {
    verifyPermission(user, 'billing:collect');

    if (input.amount <= 0) {
      throw new Error('INVALID_PAYMENT: Payment amount must be strictly greater than zero.');
    }

    const payment = await BillingRepository.recordPayment({
      ...input,
      collectedBy: user.id,
    });

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'PAYMENT_RECORDED',
      entityType: 'payments',
      entityId: payment.id,
      changesSummary: {
        invoiceId: input.invoiceId,
        amount: input.amount,
        receiptNumber: payment.receiptNumber,
        paymentMode: input.paymentMode,
      },
    });

    const payments = await BillingRepository.getPayments(input.invoiceId);
    return payments.find((p) => p.id === payment.id)!;
  }

  static async getPayments(
    user: SessionUser,
    invoiceId?: string,
    studentId?: string
  ): Promise<PaymentDto[]> {
    return BillingRepository.getPayments(invoiceId, studentId);
  }

  static async getStudentFeeSummary(
    user: SessionUser,
    studentId: string
  ): Promise<StudentFeeSummaryDto> {
    return BillingRepository.getStudentFeeSummary(studentId);
  }

  static async waiveInvoice(
    user: SessionUser,
    invoiceId: string,
    reason: string
  ): Promise<InvoiceDto> {
    verifyPermission(user, 'billing:waive');

    const db = (await import('../database/connection.js')).getDb();
    const schema = (await import('../database/schema/billing.js')).invoices;
    const { eq } = await import('drizzle-orm');

    const inv = await BillingRepository.getInvoiceById(invoiceId);
    if (!inv) {
      throw new Error(`INVOICE_NOT_FOUND: Invoice '${invoiceId}' not found.`);
    }

    await db
      .update(schema)
      .set({ status: 'cancelled' })
      .where(eq(schema.id, invoiceId));

    await AuditRepository.createLog({
      userId: user.id,
      userRole: user.role,
      action: 'INVOICE_CANCELLED',
      entityType: 'invoices',
      entityId: invoiceId,
      changesSummary: { reason },
    });

    const refreshed = await BillingRepository.getInvoiceById(invoiceId);
    return refreshed as any;
  }
}
