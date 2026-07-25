import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ParkingLocation } from './src/models/ParkingLocation.js';
import { ParkingSpot } from './src/models/ParkingSpot.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URL;
    if (!mongoUrl) throw new Error('MONGODB_URL is required');
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Clear existing data
    await ParkingLocation.deleteMany({});
    await ParkingSpot.deleteMany({});
    console.log('Cleared existing data');

    // Create parking locations
    const locations = await ParkingLocation.insertMany([
      {
        name: 'Downtown Parking Plaza',
        address: '123 Main Street',
        city: 'Karachi',
        latitude: 24.8607,
        longitude: 67.0011,
        totalSpots: 120,
        currentOccupancy: 75,
        reservedSpots: 15,
        hourlyRate: 50,
        dailyRate: 300,
        monthlyRate: 3000,
        amenities: [
          '24/7 Security',
          'CCTV',
          'EV Charging',
          'Wheelchair Accessible',
        ],
        operatingHours: { open: '00:00', close: '23:59' },
        description: 'Modern downtown parking facility with full amenities',
        isActive: true,
      },
      {
        name: 'Mall Central Parking',
        address: '456 Shopping Center Drive',
        city: 'Karachi',
        latitude: 24.8545,
        longitude: 67.0521,
        totalSpots: 200,
        currentOccupancy: 120,
        reservedSpots: 30,
        hourlyRate: 40,
        dailyRate: 250,
        monthlyRate: 2500,
        amenities: ['Shopping Mall Entry', 'Food Court Access', 'Free WiFi'],
        operatingHours: { open: '06:00', close: '23:00' },
        description: 'Large parking facility connected to shopping mall',
        isActive: true,
      },
      {
        name: 'Airport Terminal Parking',
        address: 'Jinnah International Airport',
        city: 'Karachi',
        latitude: 24.8545,
        longitude: 67.1562,
        totalSpots: 300,
        currentOccupancy: 180,
        reservedSpots: 40,
        hourlyRate: 100,
        dailyRate: 600,
        monthlyRate: 8000,
        amenities: [
          'Airport Shuttle',
          '24/7 Security',
          'Car Wash',
          'Valet Service',
        ],
        operatingHours: { open: '00:00', close: '23:59' },
        description: 'Premium parking at international airport',
        isActive: true,
      },
    ]);

    console.log(`Created ${locations.length} parking locations`);

    // Create parking spots for each location
    let spotCount = 0;
    for (const location of locations) {
      const spots = [];
      const spotsPerFloor = Math.ceil(location.totalSpots / 3); // 3 floors

      for (let floor = 0; floor < 3; floor++) {
        for (
          let i = 1;
          i <= spotsPerFloor && spots.length < location.totalSpots;
          i++
        ) {
          const section = String.fromCharCode(65 + (i % 5)); // A-E
          const spotNumber = `${section}${floor * 10 + i}`;

          // Randomly assign status based on occupancy stats
          let status = 'available';
          const randomValue = Math.random();

          if (randomValue < location.currentOccupancy / location.totalSpots) {
            status = 'occupied';
          } else if (
            randomValue <
            (location.currentOccupancy + location.reservedSpots) /
              location.totalSpots
          ) {
            status = 'reserved';
          } else if (randomValue < 0.95) {
            status = 'available';
          } else {
            status = 'maintenance';
          }

          spots.push({
            spotNumber,
            locationId: location._id,
            section,
            floor,
            status,
            spotType:
              i % 20 === 0
                ? 'compact'
                : i % 25 === 0
                  ? 'accessible'
                  : i % 30 === 0
                    ? 'evcharging'
                    : 'standard',
            lastUpdated: new Date(),
          });
        }
      }

      await ParkingSpot.insertMany(spots);
      spotCount += spots.length;
      console.log(`Created ${spots.length} spots for ${location.name}`);
    }

    console.log(`\n✅ Database seeded successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Locations created: ${locations.length}`);
    console.log(`   - Spots created: ${spotCount}`);
    console.log(
      `   - Total spots available: ${locations.reduce((sum, loc) => sum + loc.totalSpots, 0)}`
    );

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
