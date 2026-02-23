import { Request, Response } from "express";
import { CurrencyService } from "../services/CurrencyService";
import { AccountType } from "../database/entities/Ledger";

export class CurrencyController {
    private currencyService: CurrencyService;

    constructor() {
        this.currencyService = new CurrencyService();
    }

    createCurrency = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { name, description, groupId, allowNegative, maxNegativeBalance, allowNegativeGroupOnly } = req.body;

            if (!name || !groupId) {
                return res.status(400).json({ error: "Name and groupId are required" });
            }

            const allowNegativeFlag = Boolean(allowNegative);
            const allowNegativeGroupOnlyFlag = Boolean(allowNegativeGroupOnly);
            let normalizedMaxNegative: number | null = null;

            if (maxNegativeBalance !== undefined && maxNegativeBalance !== null && maxNegativeBalance !== "") {
                const parsedValue = Number(maxNegativeBalance);
                if (Number.isNaN(parsedValue)) {
                    return res.status(400).json({ error: "Invalid maxNegativeBalance value" });
                }
                if (parsedValue > 0) {
                    return res.status(400).json({ error: "maxNegativeBalance must be zero or negative" });
                }
                if (parsedValue < -1_000_000_000) {
                    return res.status(400).json({ error: "maxNegativeBalance exceeds allowed limit" });
                }
                normalizedMaxNegative = parsedValue;
            }

            if (!allowNegativeFlag) {
                normalizedMaxNegative = null;
            }

            const currency = await this.currencyService.createCurrency(
                name,
                groupId,
                req.user.id,
                {
                    allowNegative: allowNegativeFlag,
                    maxNegativeBalance: normalizedMaxNegative,
                    description,
                    allowNegativeGroupOnly: allowNegativeGroupOnlyFlag,
                }
            );

            res.status(201).json({
                id: currency.id,
                name: currency.name,
                description: currency.description,
                ename: currency.ename,
                groupId: currency.groupId,
                allowNegative: currency.allowNegative,
                allowNegativeGroupOnly: currency.allowNegativeGroupOnly,
                maxNegativeBalance: currency.maxNegativeBalance,
                createdBy: currency.createdBy,
                createdAt: currency.createdAt,
                updatedAt: currency.updatedAt,
            });
        } catch (error: any) {
            console.error("Error creating currency:", error);
            if (error.message.includes("Only group admins")) {
                return res.status(403).json({ error: error.message });
            }
            if (
                error.message.includes("Cannot restrict overdraft") ||
                error.message.includes("allowNegativeGroupOnly") ||
                error.message.includes("Cannot set max negative") ||
                error.message.includes("Max negative balance") ||
                error.message.includes("negative balances are disabled")
            ) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getAllCurrencies = async (req: Request, res: Response) => {
        try {
            const currencies = await this.currencyService.getAllCurrencies();
            res.json(currencies.map(currency => ({
                id: currency.id,
                name: currency.name,
                ename: currency.ename,
                groupId: currency.groupId,
                allowNegative: currency.allowNegative,
                allowNegativeGroupOnly: currency.allowNegativeGroupOnly,
                maxNegativeBalance: currency.maxNegativeBalance,
                createdBy: currency.createdBy,
                createdAt: currency.createdAt,
                updatedAt: currency.updatedAt,
            })));
        } catch (error) {
            console.error("Error getting currencies:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getCurrencyById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const currency = await this.currencyService.getCurrencyById(id);

            if (!currency) {
                return res.status(404).json({ error: "Currency not found" });
            }

            res.json({
                id: currency.id,
                name: currency.name,
                description: currency.description,
                ename: currency.ename,
                groupId: currency.groupId,
                allowNegative: currency.allowNegative,
                allowNegativeGroupOnly: currency.allowNegativeGroupOnly,
                maxNegativeBalance: currency.maxNegativeBalance,
                createdBy: currency.createdBy,
                createdAt: currency.createdAt,
                updatedAt: currency.updatedAt,
            });
        } catch (error) {
            console.error("Error getting currency:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getCurrenciesByGroup = async (req: Request, res: Response) => {
        try {
            const { groupId } = req.params;
            const currencies = await this.currencyService.getCurrenciesByGroup(groupId);
            res.json(currencies.map(currency => ({
                id: currency.id,
                name: currency.name,
                description: currency.description,
                ename: currency.ename,
                groupId: currency.groupId,
                allowNegative: currency.allowNegative,
                allowNegativeGroupOnly: currency.allowNegativeGroupOnly,
                maxNegativeBalance: currency.maxNegativeBalance,
                createdBy: currency.createdBy,
                createdAt: currency.createdAt,
                updatedAt: currency.updatedAt,
            })));
        } catch (error) {
            console.error("Error getting currencies by group:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    mintCurrency = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { amount, description } = req.body;

            if (!amount) {
                return res.status(400).json({ error: "amount is required" });
            }

            await this.currencyService.mintCurrency(
                id,
                amount,
                description,
                req.user.id
            );

            res.status(200).json({ message: "Currency minted successfully" });
        } catch (error: any) {
            console.error("Error minting currency:", error);
            if (error.message.includes("Only group admins") || error.message.includes("not found") || error.message.includes("must be positive")) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };

    updateMaxNegativeBalance = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { value } = req.body;

            // Allow null to clear; otherwise must be a number
            const parsedValue = value === null || value === undefined ? null : Number(value);
            if (parsedValue !== null && Number.isNaN(parsedValue)) {
                return res.status(400).json({ error: "Invalid value for maxNegativeBalance" });
            }
            if (parsedValue !== null) {
                if (parsedValue > 0) {
                    return res.status(400).json({ error: "maxNegativeBalance must be zero or negative" });
                }
                if (parsedValue < -1_000_000_000) {
                    return res.status(400).json({ error: "maxNegativeBalance exceeds allowed limit" });
                }
            }

            const updated = await this.currencyService.updateMaxNegativeBalance(
                id,
                parsedValue,
                req.user.id
            );

            res.status(200).json({
                id: updated.id,
                name: updated.name,
                description: updated.description,
                ename: updated.ename,
                groupId: updated.groupId,
                allowNegative: updated.allowNegative,
                allowNegativeGroupOnly: updated.allowNegativeGroupOnly,
                maxNegativeBalance: updated.maxNegativeBalance,
                createdBy: updated.createdBy,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
            });
        } catch (error: any) {
            console.error("Error updating max negative balance:", error);
            if (error.message.includes("Only group admins") || error.message.includes("not found") || error.message.includes("Cannot set max negative") || error.message.includes("Max negative")) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

