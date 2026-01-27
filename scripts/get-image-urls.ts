import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex);
                const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        }
    }
}
loadEnv();

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
    const sections = await prisma.pageSection.findMany({
        where: { pageId: 49 },
        include: { image: true },
        orderBy: { order: 'asc' }
    });
    
    console.log('\n=== LP Images (Page 49) ===\n');
    for (const s of sections) {
        console.log(`${s.order + 1}. ${s.role}: ${s.image?.filePath || 'NO IMAGE'}`);
    }
    console.log('\n');
    
    // Download hero image to check
    if (sections[0]?.image?.filePath) {
        console.log('Hero image URL for viewing:');
        console.log(sections[0].image.filePath);
    }
    
    await prisma.$disconnect();
}
main();
