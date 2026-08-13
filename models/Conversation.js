import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    // Who pressed "Chat Now". Only this user is ever charged a connect for the
    // conversation, and only when they send their first message — opening a
    // chat and walking away costs nothing.
    //
    // Deliberately defaults to null: conversations created before this change
    // already paid their connect up front, and a null initiator can never match
    // a sender id, so they can never be charged a second time.
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Flipped exactly once, atomically, when the initiator's first message is
    // accepted. Guards against a double charge from two rapid sends.
    connectCharged: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;