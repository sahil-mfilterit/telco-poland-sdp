import { error } from "console";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = "https://telco-poland.mfilterit.net";
// const BASE_URL = "http://localhost:3001";
const app = express();
const PORT = 3000;

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));


let cachedMfid = null;
// Route

function generatetrxid() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

app.get("/:msisdn/:serviceId", async (req, res) => {

  const trxId = generatetrxid();
  const { msisdn, serviceId } = req.params;
  try {
    const configuredMfid = await fetch(`${BASE_URL}/welcome/initate-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        trxId: trxId,
        msisdn: msisdn,
        serviceId: serviceId
      })
    });

    console.log("====================================>>>>")
    console.log(configuredMfid);
    console.log("====================================>>>>")
    const response = await configuredMfid.json();
    console.log(response);
    if (!response.data) {
      throw new Error(`Failed to initiate transaction: ${configuredMfid.status} ${configuredMfid.statusText}`);
    }
    cachedMfid = response.data.mfId;

    res.render("index", {
      title: "Express + EJS",
      message: "It works 🎉",
      trxid: trxId,
      msisdn: msisdn,
      serviceId: serviceId
    });
  } catch (error) {
    console.error('Error:', error);
    res.redirect("/error");
  }

});

app.post("/confirm", async (req, res) => {
  try{
    let  response = await fetch(`${BASE_URL}/welcome/get-status?mfId=${cachedMfid}`);
    response = await response.json();
    console.log(response);
    if (!response.data) {
      throw new Error(`Failed to get status: ${response.status} ${response.statusText}`);
    }

    let data = response.data;
    if (data.bot_status === 1) {
      res.redirect("/error?bot_reason=" + data.bot_reason + "&bot_severity=" + data.bot_severity);
    }
    res.redirect("/success");
  } catch (error) {
    console.error('Error:', error);
    res.redirect("/error");
  }
});

app.get("/error", (req, res) => {
  let { bot_reason, bot_severity } = req.query;
  res.render("error", {
    title: "Error",
    message: "Error",
    bot_reason: bot_reason,
    bot_severity: bot_severity
  });
});

app.get("/success", (req, res) => {
  res.render("success", {
    title: "Subscription Successful",
    message: "Subscription successful! Welcome to Subscribify Pro 🚀"
  });
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});