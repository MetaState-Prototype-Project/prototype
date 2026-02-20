import "reflect-metadata";
import path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(__dirname, "../../../../.env") });

import { AppDataSource } from "../src/database/data-source";
import { User } from "../src/database/entities/User";
import { Group } from "../src/database/entities/Group";

const TARGET_ENAME = process.argv[2] || "450978f2-7325-5f2a-a73f-5ae741dd548b";
const cleanEname = TARGET_ENAME.startsWith("@") ? TARGET_ENAME.slice(1) : TARGET_ENAME;

async function check() {
    await AppDataSource.initialize();
    const userRepo = AppDataSource.getRepository(User);
    const groupRepo = AppDataSource.getRepository(Group);

    console.log(`\nChecking user: ${cleanEname}\n`);

    const user = await userRepo.findOne({ where: { ename: cleanEname } });
    if (!user) {
        console.log("❌ User NOT FOUND in database!");
        await AppDataSource.destroy();
        return;
    }

    console.log("✅ User found:");
    console.log(`   ID: ${user.id}`);
    console.log(`   ename: ${user.ename}`);
    console.log(`   name: ${user.name}`);

    console.log("\n📋 Group membership check:");
    const groups = await groupRepo.find({ relations: ["members", "admins", "participants"] });
    
    for (const g of groups) {
        const isMember = g.members.some(m => m.id === user.id);
        const isAdmin = g.admins.some(a => a.id === user.id);
        const isParticipant = g.participants.some(p => p.id === user.id);
        console.log(`   - ${g.name}:`);
        console.log(`     Member: ${isMember ? "✅" : "❌"}, Admin: ${isAdmin ? "✅" : "❌"}, Participant: ${isParticipant ? "✅" : "❌"}`);
    }

    await AppDataSource.destroy();
}

check();
