const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS for frontend clients
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

/**
 * Helper function to normalize Kenyan phone numbers to 254XXXXXXXXX format
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  // Remove spaces, dashes, or plus signs
  let cleaned = phone.toString().trim().replace(/[\s+-]/g, '');
  
  // If local format starting with 07 or 01 (10 digits)
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return '254' + cleaned.substring(1);
  }
  
  // If already starts with 254 (12 digits)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Return cleaned string as fallback if it doesn't match standard patterns
  return cleaned;
}

// ------------------------------------------------------------------
// 1. Root Route (Fixes "Cannot GET /" & acts as a Render health check)
// ------------------------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'GravityPay Proxy API',
    timestamp: new Date().toISOString()
  });
});

// ------------------------------------------------------------------
// 2. STK Push Collection Endpoint (GravityPay)
// ------------------------------------------------------------------
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, amount, reference, description } = req.body;

    // Validate input fields
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    // Format phone number automatically
    const formattedPhone = formatPhoneNumber(phone);

    const collectionAmount = Number(amount) || 1000;
    if (collectionAmount < 1 || collectionAmount > 500000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount must be between 1 and 500,000 KES.' 
      });
    }

    // Read both keys from Render Environment Variables
    const secretKey = process.env.GRAVITY_SECRET_KEY;
    const publicKey = process.env.GRAVITY_PUBLIC_KEY;

    if (!secretKey || !publicKey) {
      console.error('SERVER ERROR: GRAVITY_SECRET_KEY or GRAVITY_PUBLIC_KEY is missing.');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error. API keys missing.' 
      });
    }

    // Prepare GravityPay Payload
    const gravityPayload = {
      phoneNumber: formattedPhone,
      amount: collectionAmount,
      reference: reference || `INV-${Date.now()}`,
      description: description || 'Retail Checkout'
    };

    console.log('Sending GravityPay Payload:', gravityPayload);

    // Dispatch request to GravityPay STK Push API using both auth headers
    const response = await fetch('https://api.gravitypayapp.com/api/v1/stk/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'x-api-key': publicKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gravityPayload)
    });

    const data = await response.json();
    console.log('GravityPay API Response:', data);

    if (response.ok) {
      return res.status(200).json({
        success: true,
        message: 'Payment prompt initiated successfully.',
        data: data
      });
    } else {
      return res.status(response.status).json({
        success: false,
        message: data.message || data.detail || 'Failed to initiate payment with GravityPay.',
        error: data
      });
    }

  } catch (error) {
    console.error('STK Push Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing payment request.',
      details: error.message
    });
  }
});

// ------------------------------------------------------------------
// 3. Webhook Endpoint for GravityPay Status Callbacks
// ------------------------------------------------------------------
app.post('/api/callback', (req, res) => {
  console.log('GravityPay Callback Received:', JSON.stringify(req.body, null, 2));

  // Handle transaction outcome here (e.g., update DB, grant access, etc.)

  // Acknowledge receipt to GravityPay
  res.status(200).json({ status: 'success', message: 'Callback received' });
});

// ------------------------------------------------------------------
// Server Startup
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GravityPay proxy server running on port ${PORT}`);
});
