
import mongoose from "mongoose";
import dns from "dns";

// Local DNS resolution issue ko fix karne ke liye Google DNS force karein
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    isConnected = conn.connections[0].readyState;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

export default connectDB;




// import mongoose from "mongoose";

// let isConnected = false;

// const connectDB = async () => {
//   if (isConnected) {
//     return;
//   }

//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI, {
//       serverSelectionTimeoutMS: 10000,
//     });

//     isConnected = conn.connections[0].readyState;
//     console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`❌ MongoDB Connection Error: ${error.message}`);
//     throw error;
//   }
// };

// export default connectDB;

















// import mongoose from "mongoose";

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI);
//     console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
//   } catch (error) {
//     console.error(`❌ Error: ${error.message}`);
//     process.exit(1);
//   }
// };

// export default connectDB;


