import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Vault {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    ename!: string

    @Column()
    uri!: string

    @Column()
    evault!: string
} 