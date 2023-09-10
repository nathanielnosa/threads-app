import mongoose from 'mongoose'

let isConnected = false; // to check if connected

export const connectDB = async () => {
    mongoose.set('strictQuery', true)

    if(!process.env.MONGODB_URL) return console.log('MongoDb_URL not found');
    if(isConnected) return console.log('Already connect to Database');

    try {
        await mongoose.connect(process.env.MONGODB_URL)

        isConnected = true;
        console.log('Connected to Database');
    } catch (error) {
        console.log(error);
    }
}