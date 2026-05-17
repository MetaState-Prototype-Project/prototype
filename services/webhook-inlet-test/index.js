const express = require("express");

const app = express();
const PORT = process.env.PORT || 1234;

// Accept any content type; non-JSON bodies still parse as best they can.
app.use(express.json({ limit: "10mb", type: () => true }));

// Log and 200 everything, whatever path or method it arrives on.
app.all(/.*/, (req, res) => {
    console.log("\n─────────────────────────────────────────────");
    console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
    console.log("headers:", req.headers);
    console.log("body:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`[webhook-inlet-test] listening on :${PORT}`);
});
