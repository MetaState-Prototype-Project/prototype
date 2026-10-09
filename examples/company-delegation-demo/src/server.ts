import { createApp } from "./app.js";

const port = Number(process.env.DEMO_PORT ?? 5180);
createApp(port).app.listen(port, () => {
    console.log(`Company delegation demo on http://localhost:${port}`);
});
