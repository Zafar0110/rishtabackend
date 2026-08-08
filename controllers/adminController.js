import User from "../models/User.js";

// Get Admin Dashboard Real-Time Analytics
export const getAdminDashboardStats = async (req, res) => {
  try {
    // 1. Total Registered Users (excluding Admins)
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });

    // 2. Active Proposals (Completed 7-Step Profiles)
    const activeProposals = await User.countDocuments({ 
      role: { $ne: "admin" }, 
      isProfileComplete: true 
    });

    // 3. Pending Verifications (Unverified Email Accounts)
    const pendingVerifications = await User.countDocuments({ 
      role: { $ne: "admin" }, 
      isVerified: false 
    });

    // 4. Monthly Growth Calculation (Current Month vs Last Month)
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthCount = await User.countDocuments({
      role: { $ne: "admin" },
      createdAt: { $gte: startOfCurrentMonth },
    });

    const previousMonthCount = await User.countDocuments({
      role: { $ne: "admin" },
      createdAt: { $gte: startOfPreviousMonth, $lt: startOfCurrentMonth },
    });

    let growthRate = 0;
    if (previousMonthCount > 0) {
      growthRate = (((currentMonthCount - previousMonthCount) / previousMonthCount) * 100).toFixed(1);
    } else if (currentMonthCount > 0) {
      growthRate = 100;
    }

    // 5. Month-wise User Count Aggregation for Current Year (Jan to Dec)
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const monthAgg = await User.aggregate([
      {
        $match: {
          role: { $ne: "admin" },
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" }, // Mongo $month returns 1 (Jan) to 12 (Dec)
          count: { $sum: 1 },
        },
      },
    ]);

    // Map 12 Months Array
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyUserData = monthNames.map((month, index) => {
      const monthNumber = index + 1;
      const found = monthAgg.find((m) => m._id === monthNumber);
      return {
        month,
        count: found ? found.count : 0,
      };
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeProposals,
        pendingVerifications,
        currentMonthCount,
        growthRate: Number(growthRate),
      },
      monthlyUserData,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error fetching admin stats",
      error: error.message,
    });
  }
};

// Get All Users for the Admin "Users" Table
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } })
      .select(
        "firstName lastName email phone isVerified isProfileComplete completedStep locationInfo.residenceCountry basicInfo.featuredImage basicInfo.gender createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const formattedUsers = users.map((u) => ({
      _id: u._id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User",
      email: u.email,
      phone: u.phone,
      country: u.locationInfo?.residenceCountry || "",
      image: u.basicInfo?.featuredImage || "",
      gender: u.basicInfo?.gender || "Male",
      isVerified: u.isVerified,
      isProfileComplete: u.isProfileComplete,
      createdAt: u.createdAt,
    }));

    return res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error fetching users",
      error: error.message,
    });
  }
};