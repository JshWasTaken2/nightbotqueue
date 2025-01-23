const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const http = require("http");
const app = express();
const axios = require("axios");

app.use(bodyParser.json());

const queueFile = "queue.json"; // File to store the queue persistently
let queue = []; // Array to store queue items as objects { user, item }
let queueOpen = true; // Flag to track whether the queue is open
let selfPingInterval; // Variable to store the self-ping interval ID
const projectUrl = "https://nightbotqueue.vercel.app/";


// Load the queue from the file on server startup
if (fs.existsSync(queueFile)) {
    try {
        queue = JSON.parse(fs.readFileSync(queueFile, "utf-8"));
    } catch (err) {
        console.error("Error loading queue from file:", err);
        queue = [];
    }
}


// Function to save the queue to the file
function saveQueue() {
    try {
        fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2), "utf-8");
    } catch (err) {
        console.error("Error saving queue to file:", err);
    }
}



app.get("/randomline", async (req, res) => {
    try {
        const response = await axios.get("https://pastebin.com/raw/nwYG6VsA", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        const lines = response.data.split("\n");
        const randomLine = lines[Math.floor(Math.random() * lines.length)];
        res.send(randomLine);
    } catch (error) {
        console.error("Error fetching Pastebin:", error);
        res.status(500).send("Error fetching data");
    }
});

app.get('/fight', (req, res) => {
  const user = req.query.user || req.query.fallback;
  res.send(user);
});

/*const outcomes = [
    "landed a devastating blow!", 
    "missed completely!", 
    "fought valiantly but lost.", 
    "won in an epic showdown!", 
    "was knocked out instantly!"
];

const chatUsers = ["RandomUser1", "RandomUser2", "RandomUser3"]; // Placeholder list of chatters

app.get("/fight", (req, res) => {
    const sender = req.query.sender || "Unknown"; // User who sent the command
    const target = req.query.touser || null; // Optional target specified by the sender

    let opponent, outcome;

    // If a target is provided, use it; otherwise, pick a random chatter
    if (target && target !== sender) {
        opponent = target.replace("@", "").trim();
    } else {
        // Randomly pick a user from a simulated chat list excluding the sender
        const filteredChatUsers = chatUsers.filter((user) => user !== sender);
        opponent = filteredChatUsers[Math.floor(Math.random() * filteredChatUsers.length)] || "themselves";
    }

    // Randomize fight outcome
    outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    const responseMessage = `${sender} has picked a fight with ${opponent} and ${outcome}`;
    res.send(responseMessage);
});*/



// Default route
app.get("/", (req, res) => {
    res.send("Welcome to the Nightbot Queue Manager! Use /queue, /add-to-queue, /clear-queue, /open-queue, /close-queue, or /next.");
  
});


// Endpoint to display the queue
app.get("/queue", (req, res) => {
    if (queue.length > 0) {
        const formattedQueue = queue
            .map((entry, index) => `${index + 1}. ${entry.item} (${entry.user})`)
            .join(" | ");
        return res.send(`Current Queue: ${formattedQueue}`);
    } else {
        return res.send("The queue is currently empty.");
    }
});

// Endpoint to show the next item in the queue
app.get("/next", (req, res) => {
    if (queue.length > 0) {
        const nextItem = queue[0];
        return res.send(`Next in queue: ${nextItem.item} (${nextItem.user})`);
    } else {
        return res.send("The queue is currently empty.");
    }
});

// POST endpoint to handle the "!queue" command
app.post("/add-to-queue", (req, res) => {
    const { user, message } = req.body;

    if (!queueOpen) {
        return res.send(`@${user}, the queue is currently closed. You cannot add items right now.`);
    }

    const queueItem = message.replace("!queue ", "").trim();
    if (queueItem) {
        queue.push({ user, item: queueItem });
        saveQueue(); // Save the queue to the file
        return res.send(`@${user}, your item has been added to the queue! Current queue length: ${queue.length} items.`);
    } else {
        return res.send(`@${user}, please provide an item to add to the queue. Usage: !queue <item>`);
    }
});

// GET endpoint for /add-to-queue (Nightbot-compatible)
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
        return res.send(`@${user}, your item has been added to the queue! Current queue length: ${queue.length} items.`);
    } else {
        return res.send(`@${user}, please provide an item to add to the queue. Usage: !queue <item>`);
    }
});

// POST endpoint to clear the queue
app.post("/clear-queue", (req, res) => {
    queue = [];
    saveQueue(); // Save the cleared queue to the file
    return res.send("The queue has been cleared!");
});

// GET endpoint for /clear-queue (Nightbot-compatible)
app.get("/clear-queue", (req, res) => {
    queue = [];
    saveQueue(); // Save the cleared queue to the file
    return res.send("The queue has been cleared!");
});

// POST endpoint to remove a specific item from the queue
app.post("/remove-from-queue", (req, res) => {
    const { user, message } = req.body;

    const position = parseInt(message.replace("!removequeue ", "").trim(), 10);

    if (!isNaN(position) && position > 0 && position <= queue.length) {
        const removedItem = queue.splice(position - 1, 1); // Remove the item at the given position
        saveQueue(); // Save the updated queue to the file
        return res.send(`@${user}, item #${position} has been removed from the queue!`);
    } else {
        return res.send(`@${user}, invalid position. Please provide a valid queue number to remove.`);
    }
});

// GET endpoint for /remove-from-queue (Nightbot-compatible)
app.get("/remove-from-queue", (req, res) => {
    const position = parseInt(req.query.position, 10);

    if (!isNaN(position) && position > 0 && position <= queue.length) {
        const removedItem = queue.splice(position - 1, 1); // Remove the item at the given position
        saveQueue(); // Save the updated queue to the file
        return res.send(`Item #${position} has been removed from the queue!`);
    } else {
        return res.send("Invalid position. Please provide a valid queue number to remove.");
    }
});

// Endpoint to open the queue and start self-pinging
app.get("/open-queue", (req, res) => {
    queueOpen = true;

    // Start self-pinging
    if (!selfPingInterval) {
        selfPingInterval = setInterval(() => {
            http.get(projectUrl, (res) => {
                console.log(`Pinged ${projectUrl}: ${res.statusCode}`);
            }).on("error", (err) => {
                console.error(`Error pinging ${projectUrl}: ${err.message}`);
            });
        }, 300000); // Ping every 5 minutes (300,000 ms)
        console.log("Self-pinging activated.");
    }

    res.send("The queue is now open!");
});

// Endpoint to close the queue and stop self-pinging
app.get("/close-queue", (req, res) => {
    queueOpen = false;

    // Stop self-pinging
    if (selfPingInterval) {
        clearInterval(selfPingInterval);
        selfPingInterval = null;
        console.log("Self-pinging deactivated.");
    }

    res.send("The queue is now closed!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${3000}`);
});
