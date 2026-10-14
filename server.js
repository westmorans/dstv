const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS for frontend clients
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// ------------------------------------------------------------------
// 1. Root Route (Fixes "Cannot GET /" & acts as a Render health check)
// ------------------------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'UpesiPay Proxy API',
    timestamp: new Date().toISOString()
  });
});

// ------------------------------------------------------------------
// 2. STK Push Collection Endpoint
// ------------------------------------------------------------------
app.post('/api/stkpush', async (req, res) => {
  try {
    const { phone, amount, smartcard } = req.body;

    // Validate input fields
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const collectionAmount = Number(amount) || 4200;
    if (collectionAmount < 1 || collectionAmount > 500000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount must be between 1 and 500,000 KES.' 
      });
    }

    // Read secrets from Render Environment Variables
    const authToken = process.env.UPESIPAY_AUTH_TOKEN;
    const channelId = Number(process.env.UPESIPAY_CHANNEL_ID) || 1;
    const callbackUrl = process.env.UPESIPAY_CALLBACK_URL || '';

    if (!authToken) {
      console.error('SERVER ERROR: UPESIPAY_AUTH_TOKEN environment variable is missing.');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error. Auth token missing.' 
      });
    }

    // Prepare UpesiPay Payload strictly per documentation spec
    const upesiPayload = {
      channel_id: channelId,
      phone_number: phone,
      amount: collectionAmount,
      callback_url: callbackUrl
    };

    // Format Authorization Header (Attach 'Basic ' prefix if not present in env)
    const authHeader = authToken.startsWith('Basic ') ? authToken : `Basic ${authToken}`;

    // Dispatch request to UpesiPay API
    const response = await fetch('https://upesipay.com/api/v2/collections/initiate/', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(upesiPayload)
    });

    const data = await response.json();
    console.log('UpesiPay API Response:', data);

    if (response.ok) {
      return res.status(200).json({
        success: true,
        message: 'Payment prompt initiated successfully.',
        data: data
      });
    } else {
      return res.status(response.status).json({
        success: false,
        message: data.message || data.detail || 'Failed to initiate payment with UpesiPay.',
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
// 3. Webhook Endpoint for UpesiPay Status Callbacks
// ------------------------------------------------------------------
app.post('/api/callback', (req, res) => {
  console.log('UpesiPay Callback Received:', JSON.stringify(req.body, null, 2));

  // Handle transaction outcome (e.g., update DB, grant DStv subscription, etc.)
  
  // Acknowledge receipt to UpesiPay
  res.status(200).json({ status: 'success', message: 'Callback received' });
});

// ------------------------------------------------------------------
// Server Startup
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`UpesiPay server running on port ${PORT}`);
});
