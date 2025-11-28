import mongoose from "mongoose";

export default async function dbConnect() {
  const uri =
    process.env.MONGOOSE_URI ||
    process.env.MONGO_URL ||
    "mongodb://localhost:27017/mydb";
  const options = {} as mongoose.ConnectOptions;

  await mongoose.connect(uri, options);
  return mongoose;
}
