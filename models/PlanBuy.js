import mongoose from "mongoose";

const planBuySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    packageName: { type: String, required: true },
    price: { type: Number, required: true },
    connectsAdded: { type: Number, required: true },
    stripeSessionId: { type: String, required: true, unique: true },
    paymentStatus: { type: String, default: "completed" },
  },
  { timestamps: true }
);

const PlanBuy = mongoose.model("PlanBuy", planBuySchema);
export default PlanBuy;