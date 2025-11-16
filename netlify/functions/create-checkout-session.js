// netlify/functions/create-checkout-session.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          // Price ID you create in Stripe Dashboard for "5 scans for $10"
          price: process.env.STRIPE_PRICE_ID_5_SCANS,
          quantity: 1,
        },
      ],
      success_url: "https://YOUR_NETLIFY_SITE_URL/?checkout=success",
      cancel_url: "https://YOUR_NETLIFY_SITE_URL/?checkout=cancel",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
