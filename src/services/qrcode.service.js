import QRCode from 'qrcode';
import crypto from 'crypto';

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
export const generateGateQRCode = async (locationId, locationName) => {
  const qrData = JSON.stringify({
    type: 'gate',
    locationId,
    locationName,
    generatedAt: new Date().toISOString(),
    checksum: crypto.randomBytes(8).toString('hex'),
  });

  const qrImage = await generateQRCode(qrData);

  return {
    qrData,
    qrImage,
    type: 'gate',
  };
};
