import express from 'express';
import { sql } from '../db/index.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateVerificationCode,
  generateResetToken,
  isValidEmail,
  isValidPassword,
} from '../utils/auth.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../utils/email.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = express.Router();

// Signup
authRoutes.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with at least 1 letter and 1 number',
      });
    }

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate verification code
    const verificationToken = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name, verification_token, verification_token_expires)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${name || null}, ${verificationToken}, ${verificationExpires})
      RETURNING id, email, name, email_verified, created_at
    `;

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification code.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Verify Email
authRoutes.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Find user with matching code
    const [user] = await sql`
      SELECT id, email, name, verification_token_expires
      FROM users
      WHERE email = ${email.toLowerCase()}
        AND verification_token = ${code}
        AND email_verified = false
    `;

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check if code expired
    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    // Mark email as verified
    await sql`
      UPDATE users
      SET email_verified = true,
          verification_token = NULL,
          verification_token_expires = NULL,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Send welcome email
    await sendWelcomeEmail(user.email, user.name);

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend Verification Code
authRoutes.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [user] = await sql`
      SELECT id, email_verified
      FROM users
      WHERE email = ${email.toLowerCase()}
    `;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new code
    const verificationToken = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      UPDATE users
      SET verification_token = ${verificationToken},
          verification_token_expires = ${verificationExpires},
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    await sendVerificationEmail(email, verificationToken);

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// Login
authRoutes.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [user] = await sql`
      SELECT id, email, password_hash, name, email_verified
      FROM users
      WHERE email = ${email.toLowerCase()}
    `;

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified. Please check your email for the verification code.',
        emailVerified: false,
      });
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Logged in successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Logout
authRoutes.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

// Get current user
authRoutes.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await sql`
      SELECT id, email, name, email_verified, created_at
      FROM users
      WHERE id = ${req.userId}
    `;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Forgot Password
authRoutes.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [user] = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `;

    // Don't reveal if user exists
    if (!user) {
      return res.json({ message: 'If an account exists, a password reset email has been sent' });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      UPDATE users
      SET reset_token = ${resetToken},
          reset_token_expires = ${resetExpires},
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(email, resetToken, resetUrl);

    res.json({ message: 'If an account exists, a password reset email has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset Password
authRoutes.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with at least 1 letter and 1 number',
      });
    }

    // Find user with valid reset token
    const [user] = await sql`
      SELECT id, email
      FROM users
      WHERE reset_token = ${token}
        AND reset_token_expires > NOW()
    `;

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password and clear reset token
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          reset_token = NULL,
          reset_token_expires = NULL,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change Password (for logged in users)
authRoutes.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with at least 1 letter and 1 number',
      });
    }

    // Get current password hash
    const [user] = await sql`
      SELECT password_hash FROM users WHERE id = ${req.userId}
    `;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          updated_at = NOW()
      WHERE id = ${req.userId}
    `;

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete Account
authRoutes.delete('/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    // Get current password hash
    const [user] = await sql`
      SELECT password_hash FROM users WHERE id = ${req.userId}
    `;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Delete user (CASCADE will delete related data)
    await sql`
      DELETE FROM users WHERE id = ${req.userId}
    `;

    // Clear cookie
    res.clearCookie('auth_token');

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

