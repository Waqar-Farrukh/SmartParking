// mockData.js
// Holds the heavily populated initial mock state

export const initialUsers = [
  {
    id: 'u1',
    name: 'John Doe',
    email: 'user@test.com',
    password: 'password', // purely mock
    phone: '1234567890',
    vehiclePlate: 'ABC-123',
    vehicleType: 'v2', // Car
    role: 'user',
    walletBalance: 2500,
    points: 1250,
    referralCode: 'JOHN2026',
    referredUsers: 2
  },
  {
    id: 'a1',
    name: 'Admin Boss',
    email: 'admin@test.com',
    password: 'admin',
    phone: '0000000000',
    vehiclePlate: 'ADM-001',
    vehicleType: 'v3',
    role: 'admin',
    walletBalance: 9999,
    points: 5000,
    referralCode: 'ADMINVIP',
    referredUsers: 10
  }
];

export const initialVehicleTypes = [
  { id: 'v1', name: 'Bike', baseRate: 40 },
  { id: 'v2', name: 'Car', baseRate: 80 },
  { id: 'v3', name: 'SUV', baseRate: 120 }
];

// 3 Zones, 10 spots each
export const initialSpots = [];
['A', 'B', 'C'].forEach((zone, zIdx) => {
  for (let i = 1; i <= 10; i++) {
    initialSpots.push({
      id: `Z${zone}-S${i}`,
      zone: zone,
      status: Math.random() > 0.6 ? 'occupied' : 'available'
    });
  }
});

// A few mock reservations
export const initialReservations = [
  {
    id: 'r1',
    userId: 'u1',
    spotId: 'ZA-S1',
    startTime: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hr ago
    endTime: new Date(Date.now() + 3600 * 1000).toISOString(),   // ends 1 hr from now
    status: 'active',
    finalPrice: 160
  },
  {
    id: 'r2',
    userId: 'u1',
    spotId: 'ZB-S2',
    startTime: new Date(Date.now() - 86400 * 1000).toISOString(), // yesterday
    endTime: new Date(Date.now() - 82800 * 1000).toISOString(),
    status: 'completed',
    finalPrice: 80
  }
];

export const initialViolations = [
  {
    id: 'v_r2',
    reservationId: 'r2',
    userId: 'u1',
    fineAmount: 150,
    isPaid: false
  }
];

export const initialPointTransactions = [
  { id: 'pt1', userId: 'u1', date: new Date().toISOString(), change: 200, reason: 'Referral Bonus' }
];

export const initialDiscounts = [
  { id: 'd1', code: 'DISC-DEMO', amountOff: 50, used: false, userId: 'u1' }
];

export const initialWalletTransactions = [
  { id: 'wt1', userId: 'u1', date: new Date().toISOString(), type: 'add', amount: 3000, description: 'Bank Top-Up' }
];
