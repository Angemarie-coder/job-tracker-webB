const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    console.log(`📍 URI: ${process.env.MONGODB_URI ? 'MongoDB Atlas (hidden for security)' : 'mongodb://localhost:27017/job-tracker'}`);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/job-tracker', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`🗄️  Database: ${conn.connection.name}`);
    console.log(`🔗 Connection State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    console.error('💡 Make sure your MONGODB_URI environment variable is set correctly');
    console.error('💡 Check if your MongoDB Atlas cluster is accessible from your hosting provider');
    process.exit(1);
  }
};

module.exports = connectDB;
