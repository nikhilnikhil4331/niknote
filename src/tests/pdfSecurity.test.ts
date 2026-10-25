import { describe, expect, test } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfEncryptionState, protectPdf, unlockPdf, validatePassword } from '@/lib/pdfSecurity';

async function makePdf(text = 'Hello secret'): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 200]);
  page.drawText(text, { x: 20, y: 100, size: 14, font });
  return doc.save();
}

const hasEncryptDict = (bytes: Uint8Array) => Buffer.from(bytes).includes('/Encrypt');

describe('password rules', () => {
  test('short or mismatched passwords are rejected', () => {
    expect(validatePassword('abc')).toMatch(/4 characters/);
    expect(validatePassword('abcd', 'abce')).toMatch(/match nahi/);
    expect(validatePassword('abcd', 'abcd')).toBeNull();
    expect(validatePassword('abcd')).toBeNull();
  });
});

describe('protect', () => {
  test('adds a real /Encrypt dictionary', async () => {
    const pdf = await makePdf();
    const locked = await protectPdf(pdf, { userPassword: 'nikhil123' });
    expect(hasEncryptDict(locked)).toBe(true);
    expect(locked.byteLength).toBeGreaterThan(pdf.byteLength);
  });

  test('the output cannot be opened without the password', async () => {
    const locked = await protectPdf(await makePdf(), { userPassword: 'nikhil123' });
    await expect(PDFDocument.load(locked)).rejects.toThrow();
  });

  test('rejects a too-short password', async () => {
    await expect(protectPdf(await makePdf(), { userPassword: 'ab' })).rejects.toThrow();
  });

  test('does not double-encrypt an already locked file', async () => {
    const locked = await protectPdf(await makePdf(), { userPassword: 'nikhil123' });
    await expect(protectPdf(locked, { userPassword: 'other123' })).rejects.toThrow(/pehle se protected/);
  });
});

describe('unlock', () => {
  test('removes the password and keeps the content', async () => {
    const locked = await protectPdf(await makePdf('Unlock me'), { userPassword: 'nikhil123' });
    const unlocked = await unlockPdf(locked, 'nikhil123');

    expect(hasEncryptDict(unlocked)).toBe(false);
    const doc = await PDFDocument.load(unlocked); // no password needed
    expect(doc.getPageCount()).toBe(1);
    expect(unlocked.byteLength).toBeGreaterThan(0);
  });

  test('wrong password gives a friendly error', async () => {
    const locked = await protectPdf(await makePdf(), { userPassword: 'nikhil123' });
    await expect(unlockPdf(locked, 'wrong-pass')).rejects.toThrow(/Password galat/);
  });

  test('missing password on a locked file asks for one', async () => {
    const locked = await protectPdf(await makePdf(), { userPassword: 'nikhil123' });
    await expect(unlockPdf(locked, '')).rejects.toThrow(/password daalo/);
  });
});

describe('encryption detection', () => {
  test('flat PDFs report as open', async () => {
    const info = await pdfEncryptionState(await makePdf());
    expect(info.encrypted).toBe(false);
    expect(info.pages).toBe(1);
  });

  test('protected PDFs are flagged for the Unlock tab', async () => {
    const locked = await protectPdf(await makePdf(), { userPassword: 'nikhil123' });
    const info = await pdfEncryptionState(locked);
    expect(info.encrypted).toBe(true);
    expect(info.pages).toBe(1);
  });
});
