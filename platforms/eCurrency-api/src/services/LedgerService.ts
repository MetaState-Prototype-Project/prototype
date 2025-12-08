import { Repository, LessThanOrEqual, DeepPartial } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Ledger, AccountType, LedgerType } from "../database/entities/Ledger";
import { Currency } from "../database/entities/Currency";
import { User } from "../database/entities/User";
import { Group } from "../database/entities/Group";
import { TransactionNotificationService } from "./TransactionNotificationService";

export class LedgerService {
    ledgerRepository: Repository<Ledger>;
    currencyRepository: Repository<Currency>;

    constructor() {
        this.ledgerRepository = AppDataSource.getRepository(Ledger);
        this.currencyRepository = AppDataSource.getRepository(Currency);
    }

    async getAccountBalance(currencyId: string, accountId: string, accountType: AccountType): Promise<number> {
        const latestEntry = await this.ledgerRepository.findOne({
            where: {
                currencyId,
                accountId,
                accountType,
            },
            order: {
                createdAt: "DESC"
            }
        });

        return latestEntry ? Number(latestEntry.balance) : 0;
    }

    async addLedgerEntry(
        currencyId: string,
        accountId: string,
        accountType: AccountType,
        amount: number,
        type: LedgerType,
        description?: string,
        senderAccountId?: string,
        senderAccountType?: AccountType,
        receiverAccountId?: string,
        receiverAccountType?: AccountType
    ): Promise<Ledger> {
        // Get current balance
        const currentBalance = await this.getAccountBalance(currencyId, accountId, accountType);
        
        // Calculate new balance
        const newBalance = type === LedgerType.CREDIT 
            ? currentBalance + amount 
            : currentBalance - amount;

        const entryData: DeepPartial<Ledger> = {
            currencyId,
            accountId,
            accountType,
            amount: type === LedgerType.CREDIT ? amount : -amount,
            type,
            description: description ?? undefined,
            senderAccountId: senderAccountId ?? undefined,
            senderAccountType: senderAccountType ?? undefined,
            receiverAccountId: receiverAccountId ?? undefined,
            receiverAccountType: receiverAccountType ?? undefined,
            balance: newBalance,
        };
        
        const entry = this.ledgerRepository.create(entryData);

        const saved = await this.ledgerRepository.save(entry);
        return Array.isArray(saved) ? saved[0] : saved;
    }

    async transfer(
        currencyId: string,
        fromAccountId: string,
        fromAccountType: AccountType,
        toAccountId: string,
        toAccountType: AccountType,
        amount: number,
        description?: string
    ): Promise<{ debit: Ledger; credit: Ledger }> {
        // Prevent self transfers
        if (fromAccountId === toAccountId && fromAccountType === toAccountType) {
            throw new Error("Cannot transfer to the same account");
        }

        // Get currency to check allowNegative
        const currency = await this.currencyRepository.findOne({ where: { id: currencyId } });
        if (!currency) {
            throw new Error("Currency not found");
        }

        // Only check balance if negative balances are not allowed
        if (!currency.allowNegative) {
            const currentBalance = await this.getAccountBalance(currencyId, fromAccountId, fromAccountType);
            if (currentBalance < amount) {
                throw new Error("Insufficient balance. This currency does not allow negative balances.");
            }
        }

        // Create debit entry (from sender's account)
        // Both entries have the same sender and receiver info
        const debit = await this.addLedgerEntry(
            currencyId,
            fromAccountId,
            fromAccountType,
            amount,
            LedgerType.DEBIT,
            description || `Transfer to ${toAccountType}:${toAccountId}`,
            fromAccountId, // sender
            fromAccountType, // sender type
            toAccountId, // receiver
            toAccountType // receiver type
        );

        // Create credit entry (to receiver's account)
        // Both entries have the same sender and receiver info
        const credit = await this.addLedgerEntry(
            currencyId,
            toAccountId,
            toAccountType,
            amount,
            LedgerType.CREDIT,
            description || `Transfer from ${fromAccountType}:${fromAccountId}`,
            fromAccountId, // sender
            fromAccountType, // sender type
            toAccountId, // receiver
            toAccountType // receiver type
        );

        // Send transaction notifications for all transfer types
        // (USER-to-USER, USER-to-GROUP, GROUP-to-USER, GROUP-to-GROUP)
        try {
            const notificationService = new TransactionNotificationService();
            await notificationService.sendTransactionNotifications(
                amount,
                currency,
                fromAccountId,
                fromAccountType,
                toAccountId,
                toAccountType,
                description
            );
        } catch (error) {
            // Don't fail the transfer if notification fails
            console.error("Error sending transaction notifications:", error);
        }

        return { debit, credit };
    }

    async getTransactionHistory(
        currencyId?: string,
        accountId?: string,
        accountType?: AccountType,
        limit: number = 50,
        offset: number = 0
    ): Promise<Ledger[]> {
        const queryBuilder = this.ledgerRepository.createQueryBuilder("ledger")
            .leftJoinAndSelect("ledger.currency", "currency")
            .orderBy("ledger.createdAt", "DESC")
            .limit(limit)
            .offset(offset);

        if (currencyId) {
            queryBuilder.where("ledger.currencyId = :currencyId", { currencyId });
        }

        if (accountId && accountType) {
            if (currencyId) {
                queryBuilder.andWhere("ledger.accountId = :accountId", { accountId });
                queryBuilder.andWhere("ledger.accountType = :accountType", { accountType });
            } else {
                queryBuilder.where("ledger.accountId = :accountId", { accountId });
                queryBuilder.andWhere("ledger.accountType = :accountType", { accountType });
            }
        }

        return await queryBuilder.getMany();
    }

    async initializeAccount(
        currencyId: string,
        accountId: string,
        accountType: AccountType
    ): Promise<Ledger> {
        // Check if account already exists
        const existing = await this.ledgerRepository.findOne({
            where: {
                currencyId,
                accountId,
                accountType,
            }
        });

        if (existing) {
            // Account already initialized
            return existing;
        }

        // Create initial entry with zero balance
        return await this.addLedgerEntry(
            currencyId,
            accountId,
            accountType,
            0,
            LedgerType.CREDIT,
            "Account initialized"
        );
    }

    async getAllBalancesForAccount(accountId: string, accountType: AccountType): Promise<Array<{ currency: Currency; balance: number }>> {
        // Get all unique currencies for this account
        const entries = await this.ledgerRepository
            .createQueryBuilder("ledger")
            .leftJoinAndSelect("ledger.currency", "currency")
            .where("ledger.accountId = :accountId", { accountId })
            .andWhere("ledger.accountType = :accountType", { accountType })
            .getMany();

        // Group by currency and get latest balance for each
        const currencyMap = new Map<string, { currency: Currency; balance: number }>();

        for (const entry of entries) {
            const currencyId = entry.currencyId;
            const currentBalance = await this.getAccountBalance(currencyId, accountId, accountType);
            
            if (!currencyMap.has(currencyId)) {
                currencyMap.set(currencyId, {
                    currency: entry.currency,
                    balance: currentBalance
                });
            }
        }

        return Array.from(currencyMap.values());
    }

    async getTransactionById(id: string): Promise<Ledger | null> {
        return await this.ledgerRepository.findOne({
            where: { id },
            relations: ["currency"]
        });
    }

    async findRelatedTransaction(transactionId: string): Promise<Ledger | null> {
        const transaction = await this.getTransactionById(transactionId);
        if (!transaction) return null;

        // Find transactions with same currency, same absolute amount, opposite type, within 10 seconds
        const oppositeType = transaction.type === LedgerType.DEBIT ? LedgerType.CREDIT : LedgerType.DEBIT;
        const timeWindowEnd = new Date(transaction.createdAt.getTime() + 10000);
        const timeWindowStart = new Date(transaction.createdAt.getTime() - 10000);
        const transactionAmount = Math.abs(Number(transaction.amount));

        // Try to find by exact amount match first
        let related = await this.ledgerRepository
            .createQueryBuilder("ledger")
            .where("ledger.currencyId = :currencyId", { currencyId: transaction.currencyId })
            .andWhere("ledger.type = :oppositeType", { oppositeType })
            .andWhere("ABS(ledger.amount) = :amount", { amount: transactionAmount })
            .andWhere("ledger.createdAt >= :timeWindowStart", { timeWindowStart })
            .andWhere("ledger.createdAt <= :timeWindowEnd", { timeWindowEnd })
            .andWhere("ledger.id != :transactionId", { transactionId })
            .orderBy("ABS(EXTRACT(EPOCH FROM (ledger.createdAt - :transactionTime)))", "ASC")
            .setParameter("transactionTime", transaction.createdAt)
            .getOne();

        // If not found, try a broader search with just currency, type, and time window
        if (!related) {
            related = await this.ledgerRepository
                .createQueryBuilder("ledger")
                .where("ledger.currencyId = :currencyId", { currencyId: transaction.currencyId })
                .andWhere("ledger.type = :oppositeType", { oppositeType })
                .andWhere("ledger.createdAt >= :timeWindowStart", { timeWindowStart })
                .andWhere("ledger.createdAt <= :timeWindowEnd", { timeWindowEnd })
                .andWhere("ledger.id != :transactionId", { transactionId })
                .orderBy("ABS(EXTRACT(EPOCH FROM (ledger.createdAt - :transactionTime)))", "ASC")
                .setParameter("transactionTime", transaction.createdAt)
                .limit(1)
                .getOne();
        }

        return related;
    }

    async getAccountInfo(accountId: string, accountType: AccountType): Promise<User | Group | null> {
        if (accountType === AccountType.USER) {
            const userRepository = AppDataSource.getRepository(User);
            return await userRepository.findOne({ where: { id: accountId } });
        } else {
            const groupRepository = AppDataSource.getRepository(Group);
            return await groupRepository.findOne({ where: { id: accountId } });
        }
    }

    /**
     * Get total supply for a currency by summing all account balances
     */
    async getTotalSupply(currencyId: string): Promise<number> {
        // Get all unique account combinations for this currency
        const distinctAccounts = await this.ledgerRepository
            .createQueryBuilder("ledger")
            .select("ledger.accountId", "accountId")
            .addSelect("ledger.accountType", "accountType")
            .where("ledger.currencyId = :currencyId", { currencyId })
            .distinct(true)
            .getRawMany();

        // Sum all balances
        let totalSupply = 0;
        for (const account of distinctAccounts) {
            const balance = await this.getAccountBalance(
                currencyId,
                account.accountId,
                account.accountType as AccountType
            );
            totalSupply += Number(balance);
        }

        return totalSupply;
    }
}

