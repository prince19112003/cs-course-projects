import { eq, and, desc, count } from 'drizzle-orm';
import { getDb } from '../connection.js';
import { invoices, payments, Invoice, Payment } from '../schema/billing.js';
import { students } from '../schema/students.js';
import { rooms, beds } from '../schema/infrastructure.js';
import { users } from '../schema/users.js';
import { generateEntityId } from '../utils/id-generator.js';
import {
  InvoiceDto,
  PaymentDto,
  StudentFeeSummaryDto,
} from '../../shared/types.js';

export class BillingRepository {
  /**
   * Enriched multi-table query for invoices with student details.
   */
  static async getInvoices(params: {
    studentId?: string;
    billingCycle?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ data: InvoiceDto[]; total: number }> {
    const db = getDb();
    const { studentId, billingCycle, status, limit = 50, offset = 0 } = params;

    const conditions = [];
    if (studentId) conditions.push(eq(invoices.studentId, studentId));
    if (billingCycle && billingCycle !== 'all') conditions.push(eq(invoices.billingCycle, billingCycle));
    if (status && status !== 'all') conditions.push(eq(invoices.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        inv: invoices,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        enrollmentNumber: students.enrollmentNumber,
        roomNumber: rooms.roomNumber,
      })
      .from(invoices)
      .leftJoin(students, eq(invoices.studentId, students.id))
      .leftJoin(beds, eq(students.assignedBedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    const countRes = await db.select({ value: count() }).from(invoices).where(whereClause);

    return {
      data: rows.map((r) => ({
        id: r.inv.id,
        studentId: r.inv.studentId,
        billingCycle: r.inv.billingCycle,
        description: r.inv.description,
        amountDue: r.inv.amountDue,
        amountPaid: r.inv.amountPaid,
        dueDate: r.inv.dueDate,
        status: r.inv.status as any,
        createdAt: r.inv.createdAt,
        studentName: r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName}` : undefined,
        enrollmentNumber: r.enrollmentNumber || undefined,
        roomNumber: r.roomNumber || undefined,
      })),
      total: countRes[0]?.value || 0,
    };
  }

  static async getInvoiceById(id: string): Promise<Invoice | null> {
    const db = getDb();
    const rows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return rows[0] || null;
  }

  static async createInvoice(data: {
    studentId: string;
    billingCycle: string;
    description: string;
    amountDue: number;
    dueDate: number;
  }): Promise<Invoice> {
    const db = getDb();
    const id = generateEntityId('INV');
    const now = Date.now();

    await db.insert(invoices).values({
      id,
      studentId: data.studentId,
      billingCycle: data.billingCycle,
      description: data.description.trim(),
      amountDue: data.amountDue,
      amountPaid: 0,
      dueDate: data.dueDate,
      status: 'unpaid',
      createdAt: now,
    });

    const rows = await db.select().from(invoices).where(eq(invoices.id, id));
    return rows[0];
  }

  /**
   * Atomic payment transaction:
   * 1. Validates invoice exists and is not already paid or cancelled
   * 2. Adds amount to invoice.amountPaid
   * 3. Dynamically marks invoice as 'paid' or 'partially_paid'
   * 4. Generates unique receipt number RCP-XXXXXXXX
   * 5. Inserts payment record
   */
  static async recordPayment(params: {
    invoiceId: string;
    amount: number;
    paymentMode: 'cash' | 'bank_transfer' | 'cheque' | 'pos_card';
    referenceNumber?: string;
    collectedBy: string;
  }): Promise<Payment> {
    const db = getDb();
    const now = Date.now();
    const paymentId = generateEntityId('TXN');
    const receiptNumber = generateEntityId('RCP');

    return db.transaction((tx) => {
      const inv = tx.select().from(invoices).where(eq(invoices.id, params.invoiceId)).get();
      if (!inv) {
        throw new Error(`INVOICE_NOT_FOUND: Invoice with ID '${params.invoiceId}' does not exist.`);
      }

      if (inv.status === 'paid') {
        throw new Error('INVOICE_ALREADY_PAID: This invoice is already fully paid.');
      }
      if (inv.status === 'cancelled') {
        throw new Error('INVOICE_CANCELLED: Cannot accept payments on a cancelled invoice.');
      }

      const remainingBalance = inv.amountDue - inv.amountPaid;
      if (params.amount > remainingBalance) {
        throw new Error(`OVERPAYMENT_EXCEEDED: Payment amount (${params.amount}) exceeds remaining due (${remainingBalance}).`);
      }

      const newAmountPaid = inv.amountPaid + params.amount;
      const newStatus = newAmountPaid >= inv.amountDue ? 'paid' : 'partially_paid';

      // 1. Update invoice
      tx.update(invoices)
        .set({ amountPaid: newAmountPaid, status: newStatus })
        .where(eq(invoices.id, inv.id))
        .run();

      // 2. Insert payment record
      tx.insert(payments)
        .values({
          id: paymentId,
          invoiceId: inv.id,
          studentId: inv.studentId,
          amount: params.amount,
          paymentMode: params.paymentMode,
          referenceNumber: params.referenceNumber || null,
          collectedBy: params.collectedBy,
          paymentDate: now,
          receiptNumber,
          createdAt: now,
        })
        .run();

      const createdPayment = tx.select().from(payments).where(eq(payments.id, paymentId)).get();
      return createdPayment!;
    });
  }

  static async getPayments(invoiceId?: string, studentId?: string): Promise<PaymentDto[]> {
    const db = getDb();
    const conditions = [];
    if (invoiceId) conditions.push(eq(payments.invoiceId, invoiceId));
    if (studentId) conditions.push(eq(payments.studentId, studentId));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        p: payments,
        collectorName: users.name,
      })
      .from(payments)
      .leftJoin(users, eq(payments.collectedBy, users.id))
      .where(whereClause)
      .orderBy(desc(payments.paymentDate));

    return rows.map((r) => ({
      id: r.p.id,
      invoiceId: r.p.invoiceId,
      studentId: r.p.studentId,
      amount: r.p.amount,
      paymentMode: r.p.paymentMode as any,
      referenceNumber: r.p.referenceNumber,
      collectedBy: r.p.collectedBy,
      paymentDate: r.p.paymentDate,
      receiptNumber: r.p.receiptNumber,
      createdAt: r.p.createdAt,
      collectorName: r.collectorName || undefined,
    }));
  }

  static async getStudentFeeSummary(studentId: string): Promise<StudentFeeSummaryDto> {
    const invoicesRes = await this.getInvoices({ studentId, limit: 100 });
    const paymentsRes = await this.getPayments(undefined, studentId);

    let totalInvoiced = 0;
    let totalPaid = 0;

    for (const inv of invoicesRes.data) {
      if (inv.status !== 'cancelled') {
        totalInvoiced += inv.amountDue;
        totalPaid += inv.amountPaid;
      }
    }

    return {
      totalInvoiced,
      totalPaid,
      outstandingBalance: Math.max(0, totalInvoiced - totalPaid),
      invoices: invoicesRes.data,
      payments: paymentsRes,
    };
  }
}
