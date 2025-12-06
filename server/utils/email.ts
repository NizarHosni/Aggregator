import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create reusable transporter object using SMTP transport
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!isDevelopment && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('✅ Email transporter configured for production');
  }

  return transporter;
}

// HTML template wrapper
function htmlTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-icon {
      display: inline-block;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      line-height: 60px;
      font-size: 30px;
    }
    .brand {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
      margin-top: 10px;
    }
    h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 20px;
    }
    .code-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      text-align: center;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #718096;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-icon">🩺</div>
      <div class="brand">YoDoc</div>
    </div>
    ${content}
    <div class="footer">
      <p>This is an automated email from YoDoc. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} YoDoc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const subject = 'Verify your email - YoDoc';
  const content = `
    <h1>Verify Your Email</h1>
    <p>Thank you for signing up with YoDoc! To complete your registration, please enter the verification code below:</p>
    <div class="code-box">${code}</div>
    <p>This code will expire in <strong>24 hours</strong>.</p>
    <p>If you didn't create an account with YoDoc, you can safely ignore this email.</p>
  `;

  const html = htmlTemplate(content, subject);

  // Development: Log to console
  if (isDevelopment) {
    console.log(`
┌─────────────────────────────────────────────────┐
│ 📧 EMAIL VERIFICATION                           │
├─────────────────────────────────────────────────┤
│ To: ${email.padEnd(43)} │
│ Subject: ${subject.padEnd(43)} │
│                                                  │
│ Your verification code is:                      │
│                                                  │
│ ${code.padStart(29).padEnd(47)}  │
│                                                  │
│ This code will expire in 24 hours.              │
└─────────────────────────────────────────────────┘
    `);
    return;
  }

  // Production: Send real email
  try {
    const transport = getTransporter();
    if (!transport) {
      console.error('⚠️  Email transporter not configured, falling back to console');
      console.log(`Email would be sent to: ${email} with code: ${code}`);
      return;
    }

    await transport.sendMail({
      from: `"YoDoc" <${process.env.EMAIL_FROM || 'noreply@yodoc.com'}>`,
      to: email,
      subject,
      html,
    });
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    // Fallback to console on error
    console.log(`Verification code for ${email}: ${code}`);
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<void> {
  const subject = 'Reset your password - YoDoc';
  const content = `
    <h1>Reset Your Password</h1>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
    <p>This link will expire in <strong>1 hour</strong>.</p>
    <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  `;

  const html = htmlTemplate(content, subject);

  // Development: Log to console
  if (isDevelopment) {
    console.log(`
┌─────────────────────────────────────────────────┐
│ 🔑 PASSWORD RESET                               │
├─────────────────────────────────────────────────┤
│ To: ${email.padEnd(43)} │
│ Subject: ${subject.padEnd(43)} │
│                                                  │
│ Reset your password:                             │
│                                                  │
│ ${resetUrl.substring(0, 47).padEnd(47)}  │
│                                                  │
│ This link will expire in 1 hour.                │
└─────────────────────────────────────────────────┘
    `);
    return;
  }

  // Production: Send real email
  try {
    const transport = getTransporter();
    if (!transport) {
      console.error('⚠️  Email transporter not configured, falling back to console');
      console.log(`Password reset link for ${email}: ${resetUrl}`);
      return;
    }

    await transport.sendMail({
      from: `"YoDoc" <${process.env.EMAIL_FROM || 'noreply@yodoc.com'}>`,
      to: email,
      subject,
      html,
    });
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    console.log(`Password reset link for ${email}: ${resetUrl}`);
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const subject = 'Welcome to YoDoc!';
  const content = `
    <h1>Welcome to YoDoc, ${name || 'there'}! 🎉</h1>
    <p>Your email has been verified and your account is now active.</p>
    <p>You can now:</p>
    <ul style="line-height: 2;">
      <li>🔍 Search for doctors by specialty and location</li>
      <li>❤️ Save your favorite doctors</li>
      <li>📝 Leave reviews to help other patients</li>
      <li>📅 View appointment availability</li>
    </ul>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">Start Searching for Doctors</a>
    <p>If you have any questions, feel free to reach out to our support team.</p>
  `;

  const html = htmlTemplate(content, subject);

  // Development: Log to console
  if (isDevelopment) {
    console.log(`
┌─────────────────────────────────────────────────┐
│ 👋 WELCOME TO YODOC                             │
├─────────────────────────────────────────────────┤
│ To: ${email.padEnd(43)} │
│ Subject: ${subject.padEnd(43)} │
│                                                  │
│ Hi ${(name || 'there').padEnd(43)} │
│                                                  │
│ Welcome to YoDoc! Your email has been verified. │
│ You can now search for doctors and save         │
│ your favorites.                                  │
└─────────────────────────────────────────────────┘
    `);
    return;
  }

  // Production: Send real email
  try {
    const transport = getTransporter();
    if (!transport) {
      console.log(`Welcome email would be sent to: ${email}`);
      return;
    }

    await transport.sendMail({
      from: `"YoDoc" <${process.env.EMAIL_FROM || 'noreply@yodoc.com'}>`,
      to: email,
      subject,
      html,
    });
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
  }
}
