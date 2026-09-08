import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase, getDb } from '../../src/main/database/connection.js';
import { institutions } from '../../src/main/database/schema/institutions.js';
import { users } from '../../src/main/database/schema/users.js';
import { students } from '../../src/main/database/schema/students.js';
import { BillingService } from '../../src/main/services/BillingService.js';
import { SessionUser } from '../../src/shared/types.js';

describe('Phase 06 Billing: Offline Financial Ledger & Atomic Receipts', () => {
  const mockFinanceAdmin: SessionUser = {
    id: 'USR-FINANCE-001',
    name: 'Finance Officer',
    email: 'finance@nexus.test',
    phone: '9876543233',
    role: 'accountant',
    permissions: ['billing:run', 'billing:collect', 'billing:waive', 'students:view'],
    forcePasswordChange: false,
  };

  const mockUnauthorized: SessionUser = {
    id: 'USR-STUDENT-001',
    name: 'Student Demo',
    email: 'student@nexus.test',
    phone: '9876543244',
    role: 'resident',
    permissions: ['students:view'],
    forcePasswordChange: false,
  };

  const studentId = 'STU-BILL-0001';

  beforeEach(async () => {
    closeDatabase();
    initDatabase({ inMemory: true, autoMigrate: true });

    const db = getDb();
    const now = Date.now();

    await db.insert(institutions).values({
      id: 'INST-0001',
      name: 'Nexus Tech University',
      code: 'NEXUS-01',
      address: '100 Campus Way',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(users).values({
      id: mockFinanceAdmin.id,
      name: mockFinanceAdmin.name,
      email: mockFinanceAdmin.email,
      phone: mockFinanceAdmin.phone,
      passwordHash: 'hash',
      role: 'accountant',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(students).values({
      id: studentId,
      institutionId: 'INST-0001',
      enrollmentNumber: 'ENR-BILL-001',
      firstName: 'Robert',
      lastName: 'Paulson',
      dateOfBirth: '2003-11-20',
      gender: 'male',
      email: 'robert@nexus.edu',
      phone: '9870002222',
      course: 'B.Tech',
      department: 'Civil',
      academicYear: 4,
      admissionDate: '2022-08-01',
      permanentAddress: 'City R',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('generates an invoice with INV- prefix and unpaid status', async () => {
    const invoice = await BillingService.createInvoice(mockFinanceAdmin, {
      studentId,
      billingCycle: '2026-10',
      description: 'Hostel Maintenance & Mess Fee Oct 2026',
      amountDue: 12000,
      dueDate: Date.now() + 15 * 86400000,
    });

    expect(invoice.id).toMatch(/^INV-[A-F0-9]{8}$/);
    expect(invoice.amountDue).toBe(12000);
    expect(invoice.amountPaid).toBe(0);
    expect(invoice.status).toBe('unpaid');
  });

  it('atomically records partial and full payments with unique receipt numbers and status transitions', async () => {
    const invoice = await BillingService.createInvoice(mockFinanceAdmin, {
      studentId,
      billingCycle: '2026-11',
      description: 'Hostel Fee Nov 2026',
      amountDue: 10000,
      dueDate: Date.now() + 15 * 86400000,
    });

    // 1. Partial payment of 4000 via Cash
    const p1 = await BillingService.recordPayment(mockFinanceAdmin, {
      invoiceId: invoice.id,
      amount: 4000,
      paymentMode: 'cash',
    });

    expect(p1.id).toMatch(/^TXN-[A-F0-9]{8}$/);
    expect(p1.receiptNumber).toMatch(/^RCP-[A-F0-9]{8}$/);
    expect(p1.amount).toBe(4000);

    // Verify invoice status is now partially_paid
    const invList1 = await BillingService.getInvoices(mockFinanceAdmin, { studentId });
    const inv1 = invList1.data.find((i) => i.id === invoice.id);
    expect(inv1?.amountPaid).toBe(4000);
    expect(inv1?.status).toBe('partially_paid');

    // 2. Full remaining payment of 6000 via Bank Transfer
    const p2 = await BillingService.recordPayment(mockFinanceAdmin, {
      invoiceId: invoice.id,
      amount: 6000,
      paymentMode: 'bank_transfer',
      referenceNumber: 'NEFT-9948214',
    });

    expect(p2.receiptNumber).toMatch(/^RCP-[A-F0-9]{8}$/);
    expect(p2.receiptNumber).not.toBe(p1.receiptNumber);

    // Verify invoice status is now paid
    const invList2 = await BillingService.getInvoices(mockFinanceAdmin, { studentId });
    const inv2 = invList2.data.find((i) => i.id === invoice.id);
    expect(inv2?.amountPaid).toBe(10000);
    expect(inv2?.status).toBe('paid');
  });

  it('rejects payment exceeding the outstanding balance', async () => {
    const invoice = await BillingService.createInvoice(mockFinanceAdmin, {
      studentId,
      billingCycle: '2026-12',
      description: 'Hostel Fee Dec 2026',
      amountDue: 5000,
      dueDate: Date.now() + 15 * 86400000,
    });

    await expect(
      BillingService.recordPayment(mockFinanceAdmin, {
        invoiceId: invoice.id,
        amount: 6000, // 1000 more than due!
        paymentMode: 'pos_card',
      })
    ).rejects.toThrow(/OVERPAYMENT_EXCEEDED|exceeds/i);
  });

  it('waives an invoice with official justification', async () => {
    const invoice = await BillingService.createInvoice(mockFinanceAdmin, {
      studentId,
      billingCycle: '2026-09',
      description: 'Special Fee to be waived',
      amountDue: 3000,
      dueDate: Date.now() + 15 * 86400000,
    });

    const waived = await BillingService.waiveInvoice(mockFinanceAdmin, invoice.id, 'Scholarship fee concession grant');
    expect(waived.status).toBe('cancelled');
  });

  it('calculates student fee summary correctly', async () => {
    // Student creates one paid invoice and one unpaid invoice
    const inv1 = await BillingService.createInvoice(mockFinanceAdmin, {
      studentId,
      billingCycle: '2026-01',
      description: 'Fee Jan',
      amountDue: 8000,
      dueDate: Date.now() + 86400000,
    });
    await BillingService.recordPayment(mockFinanceAdmin, {
      invoiceId: inv1.id,
      amount: 8000,
      paymentMode: 'cash',
    });

    await BillingService.createInvoice(mockFinanceAdmin, {
      studentId,
      billingCycle: '2026-02',
      description: 'Fee Feb',
      amountDue: 8000,
      dueDate: Date.now() + 86400000,
    });

    const summary = await BillingService.getStudentFeeSummary(mockFinanceAdmin, studentId);
    expect(summary.totalInvoiced).toBe(16000);
    expect(summary.totalPaid).toBe(8000);
    expect(summary.outstandingBalance).toBe(8000);
    expect(summary.invoices.length).toBe(2);
    expect(summary.payments.length).toBe(1);
  });

  it('enforces billing:run permission on invoice creation', async () => {
    await expect(
      BillingService.createInvoice(mockUnauthorized, {
        studentId,
        billingCycle: '2026-10',
        description: 'Unauthorized Fee',
        amountDue: 5000,
        dueDate: Date.now() + 86400000,
      })
    ).rejects.toThrow(/FORBIDDEN/i);
  });
});
