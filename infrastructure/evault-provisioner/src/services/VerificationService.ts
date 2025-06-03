import { DeepPartial, Repository } from "typeorm"
import { Verification } from "../entities/Verification"

export class VerificationService {
    constructor(private readonly verificationRepository: Repository<Verification>) {}

    async create(data: Partial<Verification>): Promise<Verification> {
        const verification = this.verificationRepository.create(data)
        return await this.verificationRepository.save(verification)
    }

    async findById(id: string): Promise<Verification | null> {
        return await this.verificationRepository.findOneBy({ id })
    }

    async findByIdAndUpdate(id: string, data: DeepPartial<Verification>): Promise<Verification | null> {
        // @ts-ignore
        await this.verificationRepository.update(id, data)
        return await this.findById(id)
    }

    async findOne(where: Partial<Verification>): Promise<Verification | null> {
        return await this.verificationRepository.findOneBy(where)
    }

    async findManyAndCount(
        where: Partial<Verification>,
        relations: Record<string, boolean> = {},
        order: Record<string, "ASC" | "DESC"> = {},
        pagination: { take: number; skip: number } = { take: 10, skip: 0 }
    ): Promise<[Verification[], number]> {
        return await this.verificationRepository.findAndCount({
            where,
            relations,
            order,
            take: pagination.take,
            skip: pagination.skip
        })
    }
} 