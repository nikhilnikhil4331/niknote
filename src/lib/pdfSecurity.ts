// ============================================================
// NikNote PDF Tools — password protect / unlock
//
// Uses @cantoo/pdf-lib (MIT, actively maintained fork of pdf-lib) because
// upstream pdf-lib cannot encrypt or decrypt. AES-256 (revision 6) by default,
// which is what Acrobat, Chrome, iPhone and Android all understand.
//
// "Unlock" really decrypts: pages are copied into a brand-new document, so the
// output carries no /Encrypt dictionary at all (not just a stripped one).
// ============================================================

export type ProtectOptions = {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowModifying?: boolean;
};

export type EncryptedInfo = { encrypted: boolean; pages: number };

/** Friendly validation — returns an error message or null. Pure + tested. */
export function validatePassword(password: string, confirmation?: string): string | null {
  const value = String(password ?? '');
  if (value.length < 4) return 'Password kam se kam 4 characters ka hona chahiye';
  if (confirmation !== undefined && value !== confirmation) return 'Dono password match nahi kar rahe';
  return null;
}

async function cantoo() {
  return import('@cantoo/pdf-lib');
}

export async function pdfEncryptionState(input: Uint8Array | ArrayBuffer): Promise<EncryptedInfo> {
  const { PDFDocument } = await cantoo();
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return { encrypted: Boolean((doc as any).isEncrypted), pages: doc.getPageCount() };
  } catch {
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
      return { encrypted: true, pages: doc.getPageCount() };
    } catch {
      return { encrypted: false, pages: 0 };
    }
  }
}

export async function protectPdf(
  input: Uint8Array | ArrayBuffer,
  options: ProtectOptions
): Promise<Uint8Array> {
  const problem = validatePassword(options.userPassword);
  if (problem) throw new Error(problem);

  const { PDFDocument } = await cantoo();
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  let doc;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new Error('PDF khul nahi paya — ho sakta hai ye pehle se password-protected ho');
  }

  if ((doc as any).isEncrypted) {
    throw new Error('Ye PDF pehle se protected hai — pehle Unlock karo');
  }

  doc.encrypt({
    userPassword: options.userPassword,
    ownerPassword: options.ownerPassword || options.userPassword,
    permissions: {
      printing: options.allowPrinting === false ? undefined : 'highResolution',
      copying: options.allowCopying === false ? undefined : true,
      modifying: options.allowModifying === false ? undefined : true,
      annotating: options.allowModifying === false ? undefined : true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: options.allowModifying === false ? undefined : true,
    },
  });

  doc.setProducer('NikNote PDF Tools');
  return doc.save();
}

export async function unlockPdf(
  input: Uint8Array | ArrayBuffer,
  password: string
): Promise<Uint8Array> {
  const { PDFDocument } = await cantoo();
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  let source;
  try {
    source = await PDFDocument.load(bytes, {
      password: password || undefined,
      updateMetadata: false,
    });
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (/password|encrypt/i.test(message)) {
      throw new Error(password ? 'Password galat hai' : 'Ye PDF password se protect hai — password daalo');
    }
    throw new Error('PDF khul nahi paya — file corrupt ho sakti hai');
  }

  // Copy into a fresh document: no /Encrypt, no leftovers.
  const out = await PDFDocument.create();
  const pages = await out.copyPages(source, source.getPageIndices());
  pages.forEach((page) => out.addPage(page));
  out.setProducer('NikNote PDF Tools');
  out.setCreator('NikNote');
  if (source.getTitle()) out.setTitle(source.getTitle());
  if (source.getAuthor()) out.setAuthor(source.getAuthor());

  return out.save();
}
