const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const http = require("http");
const path = require("path");
const app = express();
const axios = require("axios");

app.use(bodyParser.json());

const queueFile = "queue.json"; // File to store the queue persistently
let queue = []; // Array to store queue items as objects { user, item }
let queueOpen = true; // Flag to track whether the queue is open
let selfPingInterval; // Variable to store the self-ping interval ID
const projectUrl = "https://nightbotqueue.vercel.app/";

if (fs.existsSync(queueFile)) {
    try {
        queue = JSON.parse(fs.readFileSync(queueFile, "utf-8"));
    } catch (err) {
        console.error("Error loading queue from file:", err);
        queue = [];
    }
}

function saveQueue() {
    try {
        fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2), "utf-8");
    } catch (err) {
        console.error("Error saving queue to file:", err);
    }
}

// Serve HTML for /queue
app.get("/queue", (req, res) => {
    res.sendFile(path.join(__dirname, "queue.html"));
});

// Serve HTML for /queue-list
app.get("/queue-list", (req, res) => {
    res.sendFile(path.join(__dirname, "queue-list.html"));
});

// API endpoint to fetch /queue data in plain text
app.get("/queue-text", (req, res) => {
    if (queue.length > 0) {
        const formattedQueue = queue
            .map((entry, index) => `${index + 1}. ${entry.item} (${entry.user})`)
            .join(" | "); // Original continuous format
        res.send(`Current Queue: ${formattedQueue}`);
    } else {
        res.send("The queue is currently empty.");
    }
});

// API endpoint to fetch /queue-list data in plain text
app.get("/queue-list-text", (req, res) => {
    if (queue.length > 0) {
        const formattedQueue = queue
            .map((entry, index) => `${index + 1}. ${entry.item} (${entry.user})`)
            .join("\n"); // Each item on a new line
        res.set("Content-Type", "text/plain");
        res.send(`Current Queue:\n${formattedQueue}`);
    } else {
        res.set("Content-Type", "text/plain");
        res.send("The queue is currently empty.");
    }
});

// Real-time updates via Server-Sent Events (SSE)
app.get("/queue-updates", (req, res) => {
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });

    // Send an initial message to keep the connection open
    res.write("event: ping\n\n");

    // Send a ping message every 30 seconds to keep the connection alive
    const intervalId = setInterval(() => {
        res.write("event: ping\n\n");
    }, 30000);

    // When the client closes the connection, clear the interval
    req.on("close", () => {
        clearInterval(intervalId);
    });
});

// Add queue-related endpoints (original functionality is unchanged)
app.get("/", (req, res) => {
    res.send("Welcome to the Nightbot Queue Manager! Use /queue, /queue-list, /add-to-queue, /clear-queue, /open-queue, /close-queue, or /next.");
});

app.get("/add-to-queue", (req, res) => {
    const user = req.query.user || "anonymous";
    const message = req.query.message || "";

    if (!queueOpen) {
        return res.send(`@${user}, the queue is currently closed. You cannot add items right now.`);
    }

    const queueItem = message.replace("!queue ", "").trim();
    if (queueItem) {
        queue.push({ user, item: queueItem });
        saveQueue(); // Save the queue to the file

        // Trigger real-time updates
        sendQueueUpdate();

        return res.send(`@${user}, your item has been added to the queue! Current queue length: ${queue.length} items.`);
    } else {
        return res.send(`@${user}, please provide an item to add to the queue. Usage: !queue <item>`);
    }
});

app.get("/clear-queue", (req, res) => {
    queue = [];
    saveQueue();

    // Trigger real-time updates
    sendQueueUpdate();

    res.send("The queue has been cleared!");
});

// Utility to trigger real-time updates
function sendQueueUpdate() {
    http.get(`${projectUrl}/queue-updates`, (res) => {
        console.log("Triggered real-time update.");
    }).on("error", (err) => {
        console.error("Failed to trigger real-time update:", err.message);
    });
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
