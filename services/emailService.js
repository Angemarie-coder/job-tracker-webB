const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Send email verification
const sendVerificationEmail = async (email, firstName, verificationToken) => {
  try {
    const transporter = createTransporter();
    
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: `"Job Tracker" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Email - Job Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Job Tracker</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Your Professional Job Search Companion</p>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome, ${firstName}! 👋</h2>
            
            <p style="color:rgb(81, 90, 103); line-height: 1.6; margin-bottom: 25px;">
              Thank you for signing up for Job Tracker! To complete your registration and start tracking your job applications, 
              please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #2563eb; color: #ffffff; padding: 15px 30px; text-decoration: none; 
                        border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
              If the button above doesn't work, you can copy and paste this link into your browser:
            </p>
            
            <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin-bottom: 30px;">
              ${verificationUrl}
            </p>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This verification link will expire in 24 hours. If you didn't create an account with Job Tracker, 
                you can safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return false;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"Job Tracker" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Password - Job Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Job Tracker</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Your Professional Job Search Companion</p>
            </div>
            
            <h2 style="color: #1f2937; margin-bottom: 20px;">Hello, ${firstName}! 🔐</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
              You requested to reset your password for your Job Tracker account. Click the button below to create a new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #dc2626; color: #ffffff; padding: 15px 30px; text-decoration: none; 
                        border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
              If the button above doesn't work, you can copy and paste this link into your browser:
            </p>
            
            <p style="color: #dc2626; font-size: 14px; word-break: break-all; margin-bottom: 30px;">
              ${resetUrl}
            </p>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This reset link will expire in 10 minutes. If you didn't request a password reset, 
                you can safely ignore this email and your password will remain unchanged.
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
