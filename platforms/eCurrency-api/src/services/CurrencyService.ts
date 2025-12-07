import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { AppDataSource } from "../database/data-source";
import { Currency } from "../database/entities/Currency";
import { GroupService } from "./GroupService";
import { LedgerService } from "./LedgerService";
import { AccountType, LedgerType } from "../database/entities/Ledger";

export class CurrencyService {
    currencyRepository: Repository<Currency>;
    groupService: GroupService;
    ledgerService: LedgerService;

    constructor() {
        this.currencyRepository = AppDataSource.getRepository(Currency);
        this.groupService = new GroupService();
        this.ledgerService = new LedgerService();
    }

    async createCurrency(
        name: string,
        groupId: string,
        createdBy: string,
        allowNegative: boolean = false,
        description?: string
    ): Promise<Currency> {
        // Verify user is group admin
        const isAdmin = await this.groupService.isGroupAdmin(groupId, createdBy);
        if (!isAdmin) {
            throw new Error("Only group admins can create currencies");
        }

        // Generate eName (UUID with @ prefix)
        const ename = `@${uuidv4()}`;

        const currency = this.currencyRepository.create({
            name,
            description,
            ename,
            groupId,
            createdBy,
            allowNegative,
        });

        const savedCurrency = await this.currencyRepository.save(currency);

        // Initialize ledger account for the group
        await this.ledgerService.initializeAccount(
            savedCurrency.id,
            groupId,
            AccountType.GROUP
        );

        return savedCurrency;
    }

    async getCurrencyById(id: string): Promise<Currency | null> {
        return await this.currencyRepository.findOne({
            where: { id },
            relations: ["group", "creator"]
        });
    }

    async getCurrencyByEname(ename: string): Promise<Currency | null> {
        const cleanEname = ename.startsWith('@') ? ename.slice(1) : ename;
        return await this.currencyRepository.findOne({
            where: { ename: cleanEname },
            relations: ["group", "creator"]
        });
    }

    async getCurrenciesByGroup(groupId: string): Promise<Currency[]> {
        return await this.currencyRepository.find({
            where: { groupId },
            relations: ["group", "creator"]
        });
    }

    async getAllCurrencies(): Promise<Currency[]> {
        return await this.currencyRepository.find({
            relations: ["group", "creator"]
        });
    }

    async mintCurrency(
        currencyId: string,
        amount: number,
        description?: string,
        mintedBy?: string
    ): Promise<void> {
        // Verify user is group admin
        const currency = await this.getCurrencyById(currencyId);
        if (!currency) {
            throw new Error("Currency not found");
        }

        if (mintedBy) {
            const isAdmin = await this.groupService.isGroupAdmin(currency.groupId, mintedBy);
            if (!isAdmin) {
                throw new Error("Only group admins can mint currency");
            }
        }

        if (amount <= 0) {
            throw new Error("Mint amount must be positive");
        }

        // Always mint to the group account
        // Initialize group account if it doesn't exist
        await this.ledgerService.initializeAccount(
            currencyId,
            currency.groupId,
            AccountType.GROUP
        );

        // Add credit entry to group account
        await this.ledgerService.addLedgerEntry(
            currencyId,
            currency.groupId,
            AccountType.GROUP,
            amount,
            LedgerType.CREDIT,
            description || `Minted ${amount} ${currency.name}`
        );
    }
}

