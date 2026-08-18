import Stripe from "stripe";
import User from "../models/User.js";
import PlanBuy from "../models/PlanBuy.js";
import dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @desc    Create Stripe Checkout Session
// @route   POST /api/payment/create-checkout-session
// @desc    Create Stripe Checkout Session
// @route   POST /api/payment/create-checkout-session
export const createCheckoutSession = async (req, res) => {
    try {
      const { userId, userEmail, packageTitle, price, connects } = req.body; // 👈 Receive userEmail
  
      if (!userId || !packageTitle || !connects) {
        return res.status(400).json({ success: false, message: "Missing required package details" });
      }
  
      const numericPrice = parseFloat(price.replace(/,/g, ""));
  
      if (numericPrice === 0) {
        return res.status(200).json({ success: true, isFree: true, message: "Free package selected" });
      }
  
      const sessionData = {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "pkr",
              product_data: {
                name: `Rishta Point - ${packageTitle} Package`,
                description: `Includes ${connects} Profile Connects`,
              },
              unit_amount: Math.round(numericPrice * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/user-dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/user-dashboard?payment=cancel`,
        metadata: {
          userId,
          packageTitle,
          connects: connects.toString(),
          price: numericPrice.toString(),
        },
      };
  
      //   Auto-fill Customer Email on Stripe Checkout
      if (userEmail) {
        sessionData.customer_email = userEmail;
      }
  
      const session = await stripe.checkout.sessions.create(sessionData);
  
      res.status(200).json({ success: true, url: session.url });
    } catch (error) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

// @desc    Verify Payment Session and Add Connects to Database
// @route   POST /api/payment/verify-payment
export const verifyPayment = async (req, res) => {
   
  const requestStart = Date.now();
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID required" });
    }

    
    const [existingTransaction, session] = await Promise.all([
      PlanBuy.findOne({ stripeSessionId: sessionId }).lean(),
      stripe.checkout.sessions.retrieve(sessionId),
    ]);

     
    if (existingTransaction) {
      console.error(`[TIMING] verifyPayment (already processed) - ${Date.now() - requestStart}ms`);
      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        message: "Payment already processed",
        plan: existingTransaction,
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(400).json({ success: false, message: "Payment not completed" });
    }

    const { userId, packageTitle, connects, price } = session.metadata;
    const addedConnects = parseInt(connects, 10);

     
    const [newPlan, updatedUser] = await Promise.all([
      PlanBuy.create({
        userId,
        packageName: packageTitle,
        price: parseFloat(price),
        connectsAdded: addedConnects,
        stripeSessionId: sessionId,
        paymentStatus: "completed",
      }),
      User.findByIdAndUpdate(
        userId,
        {
          $inc: { connects: addedConnects },
          currentPackage: packageTitle,
        },
        { new: true }
      )
         
        .select("_id firstName lastName email connects currentPackage isProfileComplete completedStep role")
        .lean(),
    ]);

    console.error(`[TIMING] verifyPayment (new) - ${Date.now() - requestStart}ms`);

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully!",
      user: updatedUser,
      plan: newPlan,
    });
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getUserPlanHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    
    const user = await User.findById(userId).select("currentPackage connects createdAt");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const history = await PlanBuy.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      currentPackage: user.currentPackage || "Free",
       
      totalConnects: user.connects ?? 5,
      memberSince: user.createdAt,
      history,
    });
  } catch (error) {
    console.error("Plan History Fetch Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};