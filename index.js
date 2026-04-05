const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/", (req, res) => {
  console.log("DATA:", req.body);

  res.json({
    data: {
      success: true
    }
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Running on port " + PORT);
});
