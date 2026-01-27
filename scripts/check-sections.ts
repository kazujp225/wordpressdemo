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

async function check() {
    const sections = await prisma.pageSection.findMany({
        where: { pageId: 49 },
        orderBy: { order: 'asc' },
        take: 3
    });
    
    for (const s of sections) {
        console.log('---', s.role, '---');
        console.log('config:', s.config);
        console.log('');
    }
    
    await prisma.$disconnect();
}

check();
