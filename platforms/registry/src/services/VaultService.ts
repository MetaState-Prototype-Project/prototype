import { Repository } from "typeorm"
import { Vault} from "../entities/Vault"

export class VaultService {
    constructor(private readonly serviceRepository: Repository<Vault>) {}

    async create(ename: string, uri: string, evault: string): Promise<Vault> {
        const service = this.serviceRepository.create({ ename, uri, evault })
        return await this.serviceRepository.save(service)
    }

    async findAll(): Promise<Vault[]> {
        return await this.serviceRepository.find()
    }

    async findOne(id: number): Promise<Vault| null> {
        return await this.serviceRepository.findOneBy({ id })
    }

    async findByEname(ename: string): Promise<Vault | null> {
        return await this.serviceRepository.findOneBy({ ename })
    }

    async update(id: number, data: Partial<Vault>): Promise<Vault| null> {
        await this.serviceRepository.update(id, data)
        return await this.findOne(id)
    }

    async delete(id: number): Promise<void> {
        await this.serviceRepository.delete(id)
    }
} 