import { Router } from "express";
import { WebhookController } from "../controllers/WebhookController";

const router = Router();
const webhookController = new WebhookController();

router.post("/webhook", (req, res) => webhookController.handleWebhook(req, res));

export default router; 