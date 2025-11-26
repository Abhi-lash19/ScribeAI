import cors from "cors";
import "dotenv/config";
import express from "express";
import { apiKey } from "./serverClient";


const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));


app.get("/", (req, res) => {
  res.json({
    message: "AI Writing Assistant Server is running",
    apiKey: apiKey,
  });
});

// Start the Express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});