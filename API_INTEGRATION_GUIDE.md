# Telco Poland SDP - API Integration Guide

**Base URL:** `https://telco-poland.mfilterit.net`

This document describes how to integrate with the mFilterIt bot-detection and subscription-validation APIs for the Telco Poland SDP (Service Delivery Platform). The system provides three integration points: two REST API endpoints and a client-side JavaScript SDK.

---

## Table of Contents

1. [Overview & Flow](#1-overview--flow)
2. [Client-Side SDK — mfilter.bundle.js](#2-client-side-sdk--mfilterbundlejs)
3. [API Endpoints](#3-api-endpoints)
   - [POST /initiate-transaction](#31-post-initiate-transaction)
   - [GET /get-status](#32-get-get-status)
4. [Complete Integration Walkthrough](#4-complete-integration-walkthrough)
5. [Field Reference](#5-field-reference)

---

## 1. Overview & Flow

The integration follows a three-step flow:

```
User lands on page
        │
        ▼
┌──────────────────────────────────┐
│ Step 1: Initiate Transaction     │
│ POST /initiate-transaction       │
│ → returns mfId                   │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Step 2: Load SDK & Collect Data  │
│ Include mfilter.bundle.js        │
│ Call po(trxId, msisdn,           │
│ serviceId, btnId, optional text) │
│ → SDK monitors user behavior     │
└──────────────┬───────────────────┘
               │  (user clicks subscribe)
               ▼
┌──────────────────────────────────┐
│ Step 3: Check Bot Status         │
│ GET /get-status?mfId=...         │
│ → returns bot_status, bot_reason,│
│   bot_severity                   │
└──────────────┬───────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
   bot_status=0     bot_status=1
   (Human/Clean)    (Bot Detected)
       │                │
       ▼                ▼
   Allow action     Block / Flag
```

**Key concept:** You initiate a transaction *before* the page loads, embed the SDK on the page so it can observe user interactions, and then query the status *after* the user takes an action (e.g., clicks "Subscribe"). The API tells you whether the session looks like a real human or a bot.

---

## 2. Client-Side SDK — mfilter.bundle.js

### 2.1 Including the Script

Add the following `<script>` tag to your HTML page's `<head>`:

```html
<script src="https://telco-poland.mfilterit.net/mfilter.bundle.js"></script>
```

This makes a global function `po()` available on the page.

### 2.2 Initializing the SDK

Call `po()` after the DOM has loaded. It requires five arguments:

```javascript
po(trxId, msisdn, serviceId, buttonElementId, optionalText);
```

| Parameter         | Type   | Description                                                                                        |
| ----------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `trxId`           | string | The unique transaction ID you generated for this session (same one sent to `initiate-transaction`).|
| `msisdn`          | string | The subscriber's phone number (MSISDN).                                                            |
| `serviceId`       | string | The identifier of the service/subscription being offered.                                          |
| `buttonElementId` | string | The DOM `id` of the subscribe/CTA button the SDK should monitor (e.g., `"s_b_55442652"`).          |
| `optionalText`    | string | Operation optional text. Use `"o_T"` for standard tracking.                                        |

**Example:**

```html
<button id="s_b_55442652" class="subscribe-btn">Subscribe Now</button>

<script>
  // These values come from your server after initiating the transaction
  const trxId    = "abc123xyz";
  const msisdn   = "48501234567";
  const serviceId = "premium_weekly";

  po(trxId, msisdn, serviceId, "s_b_55442652", "o_T");
</script>
```

The SDK silently attaches event listeners to the specified button and collects behavioral signals (mouse movements, click patterns, timing, etc.) that are sent to the mFilterIt backend for bot-detection analysis.

---

## 3. API Endpoints

### 3.1 POST /initiate-transaction

Initiates a new transaction session. Must be called **before** the page is served to the user so that the `mfId` is available for status checks later.

**URL:**

```
POST https://telco-poland.mfilterit.net/initiate-transaction
```

**Headers:**

| Header         | Value              |
| -------------- | ------------------ |
| Content-Type   | application/json   |

**Request Body:**

```json
{
  "trxId": "a1b2c3d4e5f6g7h8i",
  "msisdn": "48501234567",
  "serviceId": "premium_weekly"
}
```

| Field       | Type   | Required | Description                                                                                          |
| ----------- | ------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `trxId`     | string | Yes      | A unique transaction identifier you generate per session. Alphanumeric, recommended 20+ characters.   |
| `msisdn`    | string | Yes      | The subscriber's phone number (MSISDN format, including country code).                                |
| `serviceId` | string | Yes      | The identifier for the service/subscription being offered.                                            |

**Successful Response (200):**

```json
{
  "success": true,
  "message": "Transaction initiated successfully and mfId generated for the transaction a1b2c3d4e5f6g7h8i",
  "data": { "mfId": "1771484913345CLVO", "trxId": "a1b2c3d4e5f6g7h8i" }
}
```

| Field       | Type   | Description                                                        |
| ----------- | ------ | ------------------------------------------------------------------ |
| `data.mfId` | string | A unique mFilterIt session ID. Store this — you need it for Step 3. |

**Error Response:**

If the response does not contain a `data` field, the transaction initiation failed. Check the HTTP status code and response body for details.

---

### 3.2 GET /get-status

Retrieves the bot-detection result for a previously initiated transaction. Call this **after** the user has interacted with the page (clicked the subscribe button, confirmed, etc.) so the SDK has had time to collect behavioral data.

**URL:**

```
GET https://telco-poland.mfilterit.net/get-status?mfId={mfId}
```

**Query Parameters:**

| Parameter | Type   | Required | Description                                                    |
| --------- | ------ | -------- | -------------------------------------------------------------- |
| `mfId`    | string | Yes      | The `mfId` value received from the `initiate-transaction` call.|

**Example Request:**

```
GET https://telco-poland.mfilterit.net/get-status?mfId=1771484934294VFDI
```

**Successful Response (200):**

```json
{
  "success": true,
  "message": "Bot status fetched successfully for mfId: 1771484934294VFDI",
  "data": {
    "bot_status": 0,
    "bot_reason": "NA",
    "bot_severity": "SAFE",
  }
}
```

Or, if a bot is detected:

```json
{
  "success": true,
  "message": "Bot status fetched successfully for mfId: 1771484934294VFDI",
  "data": {
    "bot_status": 1,
    "bot_reason": "GEO_MISMATCH",
    "bot_severity": "MEDIUM",
  }
}
```

| Field              | Type         | Description                                                                    |
| ------------------ | ------------ | ------------------------------------------------------------------------------ |
| `data.bot_status`  | number (0/1) | `0` = human (clean session), `1` = bot detected.                               |
| `data.bot_reason`  | string/null  | When `bot_status` is `1`, a human-readable reason describing the detection.     |
| `data.bot_severity`| string/null  | When `bot_status` is `1`, the severity level (e.g., `"high"`, `"medium"`, `"low"`). |

**Decision Logic:**

| `bot_status` | Action                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| `0`          | Proceed with the subscription/service activation.                      |
| `1`          | Block the subscription. Optionally log `bot_reason` and `bot_severity`.|

---

## 4. Complete Integration Walkthrough

Below is a full server-side + client-side example using Node.js (Express) and plain HTML.

### 4.1 Generate a Transaction ID

Generate a unique transaction ID on your server for each user session:

```javascript
function generateTrxId() {
  return Math.random().toString(36).substring(2, 15)
       + Math.random().toString(36).substring(2, 15);
}
```

### 4.2 Server-Side: Initiate Transaction

When the user navigates to the subscription page, call the initiation endpoint from your backend:

```javascript
const BASE_URL = "https://telco-poland.mfilterit.net";

app.get("/:msisdn/:serviceId", async (req, res) => {
  const trxId = generateTrxId();
  const { msisdn, serviceId } = req.params;

  const response = await fetch(`${BASE_URL}/initiate-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trxId, msisdn, serviceId })
  });

  const result = await response.json();

  if (!result.data) {
    // Handle initiation failure
    return res.redirect("/error");
  }

  // Store mfId for later status check (use a session store in production)
  req.session.mfId = result.data.mfId;

  // Render page with trxId, msisdn, serviceId for the client-side SDK
  res.render("subscribe", { trxId, msisdn, serviceId });
});
```

### 4.3 Client-Side: Load SDK and Initialize

In your HTML template, include the SDK and call `po()`:

```html
<head>
  <script src="https://telco-poland.mfilterit.net/mfilter.bundle.js"></script>
</head>
<body>
  <!-- Hidden fields carrying server-provided values -->
  <div style="display:none" id="po_trxid">{{trxId}}</div>

  <button id="subscribeBtn">Subscribe Now</button>

  <script>
    const trxId     = "{{po_trxid}}";
    const msisdn    = "{{msisdn}}";
    const serviceId = "{{serviceId}}";
    const buttonID  = "{{buttonID}}";

    // Initialize mFilterIt SDK
    po(trxId, msisdn, serviceId, buttonID, "optional text");
  </script>
</body>
```

### 4.4 Server-Side: Check Bot Status After User Action

When the user confirms the subscription, query the status endpoint:

```javascript
app.post("/confirm", async (req, res) => {
  const mfId = req.session.mfId;

  const response = await fetch(
    `${BASE_URL}/get-status?mfId=${mfId}`
  );
  const result = await response.json();

  if (!result.data) {
    return res.redirect("/error");
  }

  if (result.data.bot_status === 1) {
    // Bot detected — block the subscription
    console.log("Bot detected:", result.data.bot_reason);
    return res.redirect(`/error`);
  }

  // Human verified — proceed with subscription activation
  res.redirect("/success");
});
```

---

# 5. Field Reference

### Transaction ID (`trxId`)

- Generated by the integrating application (your server).
- Must be unique per user session / page load.
- Alphanumeric string, recommended minimum 20 characters.
- Used to correlate the SDK's client-side data collection with the server-side API calls.

### MSISDN (`msisdn`)

- The subscriber's mobile phone number.
- Should include country code (e.g., `48` for Poland): `48501234567`.

### Service ID (`serviceId`)

- Identifies the subscription product or service being offered.
- Provided by the service configuration (e.g., `"premium_weekly"`, `"daily_news"`).

### mFilterIt ID (`mfId`)

- Returned by the `initiate-transaction` endpoint.
- Represents a unique analysis session on the mFilterIt backend.
- Must be stored server-side and passed to `get-status` after the user action.

### Bot Status Fields

| Field          | Values               | Meaning                                 |
| -------------- | -------------------- | --------------------------------------- |
| `bot_status`   | `0`                  | Human — session is clean                |
| `bot_status`   | `1`                  | Bot — automated/fraudulent activity     |
| `bot_reason`   | string or null       | Explanation when bot is detected        |
| `bot_severity` | `"high"` / `"medium"` / `"low"` or null | Confidence/severity of detection |

---

## Quick Reference

| Step | What                    | Endpoint / Asset                                           | When                            |
| ---- | ----------------------- | ---------------------------------------------------------- | ------------------------------- |
| 1    | Initiate transaction    | `POST /initiate-transaction`                               | On page load (server-side)      |
| 2    | Load SDK & call `po()`  | `<script src=".../mfilter.bundle.js">` + `po(...)`         | On page load (client-side)      |
| 3    | Check status            | `GET /get-status?mfId=...`                                 | After user action (server-side) |
