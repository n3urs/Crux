/**
 * Welcome email service for new gym provisioning
 * Sends onboarding email to gym owners when their gym is created.
 */

const nodemailer = require('nodemailer');

const SMTP_USER = process.env.SMTP_USER || 'cruxgymhq@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'Crux <hello@cruxgym.co.uk>';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Send welcome email to new gym owner
 * @param {string} gymId - Gym subdomain identifier
 * @param {string} gymName - Human-readable gym name
 * @param {string} ownerEmail - Email address of gym owner
 * @returns {Promise<object>} - Nodemailer info object
 */
async function sendWelcomeEmail(gymId, gymName, ownerEmail) {
  const subdomain = `${gymId}.cruxgym.co.uk`;
  const subdomainUrl = `https://${subdomain}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
      color: #333;
    }
    .content h2 {
      color: #2563eb;
      font-size: 24px;
      margin: 0 0 20px 0;
    }
    .content p {
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .highlight-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .highlight-box strong {
      display: block;
      color: #2563eb;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .highlight-box .value {
      font-size: 18px;
      color: #333;
      font-weight: 600;
      word-break: break-all;
    }
    .cta-button {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      transition: background 0.2s;
    }
    .cta-button:hover {
      background: #1d4ed8;
    }
    .steps {
      background: #f9fafb;
      padding: 25px;
      border-radius: 6px;
      margin: 25px 0;
    }
    .steps h3 {
      color: #374151;
      font-size: 18px;
      margin: 0 0 15px 0;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
      color: #4b5563;
    }
    .steps li {
      margin-bottom: 10px;
      line-height: 1.6;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #2563eb;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to Crux!</h1>
    </div>
    
    <div class="content">
      <h2>Your gym is ready, ${gymName}!</h2>
      
      <p>Congratulations! Your Crux gym management platform has been provisioned and is ready to use.</p>
      
      <div class="highlight-box">
        <strong>Your Subdomain</strong>
        <div class="value">${subdomain}</div>
      </div>
      
      <p>Your platform includes a <strong>14-day free trial</strong> with full access to all Growth plan features:</p>
      
      <ul>
        <li>✓ Unlimited member check-ins</li>
        <li>✓ Digital waivers & photo capture</li>
        <li>✓ Pass management (day passes, memberships)</li>
        <li>✓ Point-of-sale & gift cards</li>
        <li>✓ Route setting & climbing analytics</li>
        <li>✓ Staff accounts & permissions</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="${subdomainUrl}" class="cta-button">Log In to Your Gym →</a>
      </div>
      
      <div class="steps">
        <h3>🚀 Next Steps</h3>
        <ol>
          <li><strong>Complete setup wizard</strong> — Add your gym details, logo, and first staff member</li>
          <li><strong>Configure pass types</strong> — Customize pricing for day passes and memberships</li>
          <li><strong>Set up waivers</strong> — Review and edit the default waiver template</li>
          <li><strong>Add members</strong> — Import existing members or start registering new ones</li>
          <li><strong>Train your team</strong> — Invite staff and walk through the check-in process</li>
        </ol>
      </div>
      
      <p>Need help getting started? We're here for you:</p>
      <p style="text-align: center;">
        📧 <a href="mailto:hello@cruxgym.co.uk" style="color: #2563eb; text-decoration: none; font-weight: 600;">hello@cruxgym.co.uk</a>
      </p>
    </div>
    
    <div class="footer">
      <p>
        You're receiving this email because a Crux gym account was created for ${gymName}.<br>
        If you didn't request this, please contact us at <a href="mailto:hello@cruxgym.co.uk">hello@cruxgym.co.uk</a>.
      </p>
      <p style="margin-top: 15px;">
        <a href="${subdomainUrl}">Dashboard</a> · 
        <a href="mailto:hello@cruxgym.co.uk">Support</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Welcome to Crux — Your Gym is Ready!

Congratulations, ${gymName}! Your Crux gym management platform has been provisioned.

Your Subdomain: ${subdomain}
Log in at: ${subdomainUrl}

You have a 14-day free trial with full access to all Growth plan features:
  ✓ Unlimited member check-ins
  ✓ Digital waivers & photo capture
  ✓ Pass management (day passes, memberships)
  ✓ Point-of-sale & gift cards
  ✓ Route setting & climbing analytics
  ✓ Staff accounts & permissions

Next Steps:
  1. Complete setup wizard — Add your gym details, logo, and first staff member
  2. Configure pass types — Customize pricing for day passes and memberships
  3. Set up waivers — Review and edit the default waiver template
  4. Add members — Import existing members or start registering new ones
  5. Train your team — Invite staff and walk through the check-in process

Need help? Email us at hello@cruxgym.co.uk

---
You're receiving this email because a Crux gym account was created for ${gymName}.
If you didn't request this, please contact hello@cruxgym.co.uk.
  `.trim();

  const mailOptions = {
    from: SMTP_FROM,
    to: ownerEmail,
    subject: `Welcome to Crux — Your gym is ready`,
    text: textBody,
    html: htmlBody,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendWelcomeEmail };
