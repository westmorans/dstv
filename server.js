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
    service: 'SmartPay Pesa Proxy API',
    timestamp: new Date().toISOString()
  });
});

// ------------------------------------------------------------------
// 2. STK Push Collection Endpoint (SmartPay Pesa)
// ------------------------------------------------------------------
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, amount, reference, account_reference, description } = req.body;

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

    // Read API key from Render Environment Variables
    const apiKey = process.env.SMARTPAY_API_KEY;

    if (!apiKey) {
      console.error('SERVER ERROR: SMARTPAY_API_KEY is missing.');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error. API key missing.' 
      });
    }

    // Prepare SmartPay Pesa Payload matching your curl request format
    const smartPayPayload = {
      phone: formattedPhone,
      amount: collectionAmount,
      account_reference: account_reference || reference || `ORDER-${Date.now()}`
    };

    // Include description optionally if the API supports it
    if (description) {
      smartPayPayload.description = description;
    }

    console.log('Sending SmartPay Pesa Payload:', smartPayPayload);

    // Dispatch request to SmartPay Pesa STK Push API
    const response = await fetch('https://api.smartpaypesa.com/v1/stk/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smartPayPayload)
    });

    const data = await response.json();
    console.log('SmartPay Pesa API Response:', data);

    if (response.ok) {
      return res.status(200).json({
        success: true,
        message: 'Payment prompt initiated successfully.',
        data: data
      });
    } else {
      return res.status(response.status).json({
        success: false,
        message: data.message || data.detail || 'Failed to initiate payment with SmartPay Pesa.',
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
// 3. Webhook Endpoint for SmartPay Pesa Status Callbacks
// ------------------------------------------------------------------
app.post('/api/callback', (req, res) => {
  console.log('SmartPay Pesa Callback Received:', JSON.stringify(req.body, null, 2));

  // Handle transaction outcome here (e.g., update DB, grant access, etc.)

  // Acknowledge receipt to SmartPay Pesa
  res.status(200).json({ status: 'success', message: 'Callback received' });
});

// ------------------------------------------------------------------
// Server Startup
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SmartPay Pesa proxy server running on port ${PORT}`);
});
