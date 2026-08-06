import express from "express";
import { createCheckoutSession, verifyPayment } from "../controllers/paymentController.js";
import { getUserPlanHistory } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create-checkout-session", createCheckoutSession);
router.post("/verify-payment", verifyPayment);
router.get("/plan-history/:userId", getUserPlanHistory);

export default router;