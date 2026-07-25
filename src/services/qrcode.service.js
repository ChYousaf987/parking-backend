import QRCode from 'qrcode';
import crypto from 'crypto';

const getSigningSecret = () => {
  const secret = process.env.QR_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('QR_SIGNING_SECRET is not configured');
  return secret;
};

const signPayload = payload =>
  crypto
    .createHmac('sha256', getSigningSecret())
    .update(JSON.stringify(payload))
    .digest('hex');

// Generate QR Code Data
export const generateQRCodeData = (sessionId, slotNumber, floor, location) => {
  const qrData = {
    sessionId,
    slotNumber,
    floor,
    location,
    generatedAt: new Date().toISOString(),
    checksum: crypto.randomBytes(8).toString('hex'),
  };

  return JSON.stringify(qrData);
};

// Generate QR Code Image
export const generateQRCode = async data => {
  try {
    const qrCodeImage = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeImage;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

// Parse QR Code Data
export const parseQRCode = qrData => {
  try {
    return JSON.parse(qrData);
  } catch (error) {
    console.error('Error parsing QR code:', error);
    throw new Error('Invalid QR code format');
  }
};

// Generate Entry QR Code
export const generateEntryQRCode = async (
  parkingSpotId,
  slotNumber,
  floor,
  locationName
) => {
  const qrData = generateQRCodeData(
    `entry_${parkingSpotId}_${Date.now()}`,
    slotNumber,
    floor,
    locationName
  );

  const qrImage = await generateQRCode(qrData);

  return {
    qrData,
    qrImage,
    type: 'entry',
  };
};

// Generate Exit QR Code
export const generateExitQRCode = async (
  sessionId,
  slotNumber,
  floor,
  locationName
) => {
  const qrData = generateQRCodeData(
    `exit_${sessionId}_${Date.now()}`,
    slotNumber,
    floor,
    locationName
  );

  const qrImage = await generateQRCode(qrData);

  return {
    qrData,
    qrImage,
    type: 'exit',
  };
};

// Generate Gate QR Code (static entrance QR)
export const generateGateQRCode = async (
  locationId,
  locationName,
  gateType = 'entry'
) => {
  if (!['entry', 'exit'].includes(gateType)) {
    throw new Error('Gate type must be entry or exit');
  }

  // This payload is intentionally static. Slot availability is always read live
  // from MongoDB after the customer scans it.
  const payload = {
    version: 1,
    type: 'gate',
    gateType,
    locationId,
    locationName,
  };
  const qrData = JSON.stringify({ ...payload, signature: signPayload(payload) });

  const qrImage = await generateQRCode(qrData);

  return {
    qrData,
    qrImage,
    type: 'gate',
  };
};

// Only signed gate QR codes issued by this backend are accepted at entry/exit.
export const parseAndVerifyGateQRCode = qrData => {
  let scanned;
  try {
    scanned = JSON.parse(qrData);
  } catch {
    throw new Error('Invalid QR code format');
  }

  const { signature, ...payload } = scanned;
  if (
    !signature ||
    payload.type !== 'gate' ||
    !['entry', 'exit'].includes(payload.gateType) ||
    !payload.locationId
  ) {
    throw new Error('Invalid gate QR code');
  }

  const expected = signPayload(payload);
  const providedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error('QR code signature is invalid');
  }

  return payload;
};
