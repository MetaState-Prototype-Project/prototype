import { Column, Entity } from "typeorm";

@Entity("verification")
export class Verification {
    @Column("varchar", { primary: true, name: "id", length: 36 })
    id: string;

    @Column("text", { name: "identifier", nullable: false })
    identifier: string;

    @Column("text", { name: "value", nullable: false })
    value: string;

    @Column("timestamp", { name: "expiresAt", nullable: false })
    expiresAt: Date;

    @Column("timestamp", { name: "createdAt", nullable: true })
    createdAt: Date;

    @Column("timestamp", { name: "updatedAt", nullable: true })
    updatedAt: Date;
}
