const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Endpoint triggered by your frontend
app.post('/api/stkpush', async (req, res) => {
  const { phone, smartcard, amount } = req.body;

  try {
    const response = await fetch("https://upesipay.com/api/v2/collections/initiate/", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${process.env.UPESIPAY_AUTH_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel_id: 1,
        phone_number: phone,
        amount: amount || 4200,
        callback_url: "https://your-render-app.onrender.com/api/callback"
      })
    });

    const data = await response.json();

    if (response.ok) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(response.status).json({ success: false, error: data });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Webhook endpoint to receive UpesiPay payment results
app.post('/api/callback', (req, res) => {
  console.log("Payment Callback Received:", req.body);
  // Update database / activate user account here
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
