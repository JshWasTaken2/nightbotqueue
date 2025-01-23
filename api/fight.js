export default function handler(req, res) {
  const { sender, touser, randomChatter } = req.query;

  // Validate query parameters
  if (!sender) {
    return res.status(400).send("Missing 'sender' parameter");
  }

  // Determine the response based on the presence of `touser`
  const target = touser || randomChatter || "someone";
  const message = `${sender} picked a fight with ${target} $(urlfetch https://pastebin.com/raw/nwYG6VsA)!`;

  res.status(200).send(message);
}