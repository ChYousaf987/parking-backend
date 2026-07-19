import nodemailer from 'nodemailer';

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password',
  },
});

// Generate random OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Email
export const sendOTPEmail = async (email, otp, name) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Parking Registration OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Soptsco Parking</h1>
          </div>
          
          <div style="background: #f7f7f7; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="color: #333; font-size: 16px;">Hello ${name},</p>
            
            <p style="color: #666; font-size: 14px;">Your One-Time Password (OTP) for email verification is:</p>
            
            <div style="background: white; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; border: 2px solid #667eea;">
              <h2 style="color: #667eea; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h2>
            </div>
            
            <p style="color: #666; font-size: 13px; text-align: center;">This OTP will expire in 10 minutes.</p>
            
            <p style="color: #666; font-size: 13px;">If you did not request this OTP, please ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2026 Soptsco Parking. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

// Verify OTP
export const verifyOTP = (storedOTP, providedOTP) => {
  return storedOTP === providedOTP;
};
