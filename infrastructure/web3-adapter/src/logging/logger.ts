import pino from "pino";
import { transport } from "./transport";

export const logger = pino(transport);
