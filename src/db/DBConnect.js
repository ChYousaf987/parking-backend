import mongoose from 'mongoose';

export const DBConnect = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URL);
    console.log(`MongoDB Connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
