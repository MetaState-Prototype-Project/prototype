import { Request, Response } from "express";
import { LedgerService } from "../services/LedgerService";
import { AccountType } from "../database/entities/Ledger";

export class LedgerController {
    private ledgerService: LedgerService;

    constructor() {
        this.ledgerService = new LedgerService();
    }

    getBalance = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { currencyId, accountType, accountId } = req.query;

            // Support account context (user or group)
            const finalAccountId = accountId ? (accountId as string) : req.user.id;
            const finalAccountType = accountType ? (accountType as AccountType) : AccountType.USER;

            if (!Object.values(AccountType).includes(finalAccountType)) {
                return res.status(400).json({ error: "Invalid accountType" });
            }

            if (currencyId) {
                // Get balance for specific currency
                const balance = await this.ledgerService.getAccountBalance(
                    currencyId as string,
                    finalAccountId,
                    finalAccountType
                );
                res.json({ currencyId, balance });
            } else {
                // Get all balances for account
                const balances = await this.ledgerService.getAllBalancesForAccount(
                    finalAccountId,
                    finalAccountType
                );
                res.json(balances.map(b => ({
                    currency: {
                        id: b.currency.id,
                        name: b.currency.name,
                        ename: b.currency.ename,
                    },
                    balance: b.balance,
                })));
            }
        } catch (error) {
            console.error("Error getting balance:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getBalanceByCurrencyId = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { currencyId } = req.params;
            const balance = await this.ledgerService.getAccountBalance(
                currencyId,
                req.user.id,
                AccountType.USER
            );
            res.json({ currencyId, balance });
        } catch (error) {
            console.error("Error getting balance:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    transfer = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { currencyId, fromAccountId, fromAccountType, toAccountId, toAccountType, amount, description } = req.body;

            if (!currencyId || !toAccountId || !toAccountType || !amount) {
                return res.status(400).json({ error: "currencyId, toAccountId, toAccountType, and amount are required" });
            }

            if (!Object.values(AccountType).includes(toAccountType)) {
                return res.status(400).json({ error: "Invalid toAccountType" });
            }

            if (amount <= 0) {
                return res.status(400).json({ error: "Amount must be positive" });
            }

            // Use provided fromAccount or default to user
            const finalFromAccountId = fromAccountId || req.user.id;
            const finalFromAccountType = fromAccountType || AccountType.USER;

            if (!Object.values(AccountType).includes(finalFromAccountType)) {
                return res.status(400).json({ error: "Invalid fromAccountType" });
            }

            // Verify user has permission to transfer from this account
            if (finalFromAccountType === AccountType.GROUP) {
                // TODO: Verify user is admin of the group
            } else if (finalFromAccountId !== req.user.id) {
                return res.status(403).json({ error: "You can only transfer from your own account" });
            }

            const result = await this.ledgerService.transfer(
                currencyId,
                finalFromAccountId,
                finalFromAccountType,
                toAccountId,
                toAccountType,
                amount,
                description
            );

            res.json({
                message: "Transfer successful",
                debit: {
                    id: result.debit.id,
                    amount: result.debit.amount,
                    balance: result.debit.balance,
                    createdAt: result.debit.createdAt,
                },
                credit: {
                    id: result.credit.id,
                    amount: result.credit.amount,
                    balance: result.credit.balance,
                    createdAt: result.credit.createdAt,
                },
            });
        } catch (error: any) {
            console.error("Error transferring:", error);
            if (error.message.includes("Insufficient balance") || error.message.includes("not found")) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getHistory = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            // Check if currencyId is in route params (from /history/:currencyId)
            const currencyIdFromParams = (req.params as any).currencyId;
            const { currencyId: currencyIdFromQuery, accountType, accountId, limit, offset } = req.query;
            const currencyId = currencyIdFromParams || (currencyIdFromQuery as string | undefined);
            const limitNum = limit ? parseInt(limit as string) : 50;
            const offsetNum = offset ? parseInt(offset as string) : 0;

            // If accountType and accountId are provided, use them (for group accounts)
            const finalAccountId = accountId ? (accountId as string) : req.user.id;
            const finalAccountType = accountType ? (accountType as AccountType) : AccountType.USER;

            const history = await this.ledgerService.getTransactionHistory(
                currencyId,
                finalAccountId,
                finalAccountType,
                limitNum,
                offsetNum
            );

            // Enrich transactions with sender/receiver info
            const enrichedHistory = await Promise.all(history.map(async (entry) => {
                const accountInfo = await this.ledgerService.getAccountInfo(
                    entry.accountId,
                    entry.accountType
                );

                // Get sender and receiver info from stored fields
                let sender = null;
                let receiver = null;
                
                if (entry.senderAccountId && entry.senderAccountType) {
                    sender = await this.ledgerService.getAccountInfo(
                        entry.senderAccountId,
                        entry.senderAccountType
                    );
                }
                
                if (entry.receiverAccountId && entry.receiverAccountType) {
                    receiver = await this.ledgerService.getAccountInfo(
                        entry.receiverAccountId,
                        entry.receiverAccountType
                    );
                }

                return {
                    id: entry.id,
                    currencyId: entry.currencyId,
                    accountId: entry.accountId,
                    accountType: entry.accountType,
                    amount: entry.amount,
                    type: entry.type,
                    description: entry.description,
                    balance: entry.balance,
                    createdAt: entry.createdAt,
                    sender: sender ? {
                        name: (sender as any).name || (sender as any).handle,
                        ename: (sender as any).ename,
                    } : null,
                    receiver: receiver ? {
                        name: (receiver as any).name || (receiver as any).handle,
                        ename: (receiver as any).ename,
                    } : null,
                };
            }));

            res.json(enrichedHistory);
        } catch (error) {
            console.error("Error getting history:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getTransactionById = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const transaction = await this.ledgerService.getTransactionById(id);

            if (!transaction) {
                return res.status(404).json({ error: "Transaction not found" });
            }

            // Get account info for this transaction
            const accountInfo = await this.ledgerService.getAccountInfo(
                transaction.accountId,
                transaction.accountType
            );

            // Get sender and receiver info from stored fields
            let sender = null;
            let receiver = null;
            
            if (transaction.senderAccountId && transaction.senderAccountType) {
                sender = await this.ledgerService.getAccountInfo(
                    transaction.senderAccountId,
                    transaction.senderAccountType
                );
            }
            
            if (transaction.receiverAccountId && transaction.receiverAccountType) {
                receiver = await this.ledgerService.getAccountInfo(
                    transaction.receiverAccountId,
                    transaction.receiverAccountType
                );
            }

            res.json({
                id: transaction.id,
                currencyId: transaction.currencyId,
                currency: transaction.currency,
                accountId: transaction.accountId,
                accountType: transaction.accountType,
                amount: transaction.amount,
                type: transaction.type,
                description: transaction.description,
                balance: transaction.balance,
                createdAt: transaction.createdAt,
                sender: sender ? {
                    id: sender.id,
                    name: (sender as any).name || (sender as any).handle,
                    ename: (sender as any).ename,
                } : null,
                receiver: receiver ? {
                    id: receiver.id,
                    name: (receiver as any).name || (receiver as any).handle,
                    ename: (receiver as any).ename,
                } : null,
            });
        } catch (error) {
            console.error("Error getting transaction:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    initializeAccount = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { currencyId } = req.body;

            if (!currencyId) {
                return res.status(400).json({ error: "currencyId is required" });
            }

            await this.ledgerService.initializeAccount(
                currencyId,
                req.user.id,
                AccountType.USER
            );

            res.json({ message: "Account initialized successfully" });
        } catch (error) {
            console.error("Error initializing account:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    getAccountDetails = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { currencyId } = req.params;
            const { accountType, accountId } = req.query;

            const finalAccountId = accountId ? (accountId as string) : req.user.id;
            const finalAccountType = accountType ? (accountType as AccountType) : AccountType.USER;

            const balance = await this.ledgerService.getAccountBalance(
                currencyId,
                finalAccountId,
                finalAccountType
            );

            const accountInfo = await this.ledgerService.getAccountInfo(
                finalAccountId,
                finalAccountType
            );

            // Account address is always the eName
            const accountAddress = accountInfo ? ((accountInfo as any).ename || null) : null;

            res.json({
                currencyId,
                accountId: finalAccountId,
                accountType: finalAccountType,
                balance,
                accountInfo: accountInfo ? {
                    id: accountInfo.id,
                    name: (accountInfo as any).name || (accountInfo as any).handle,
                    ename: (accountInfo as any).ename,
                } : null,
                accountAddress, // This is the eName used for transfers
            });
        } catch (error) {
            console.error("Error getting account details:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}

