import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TemplatesContainer } from '@/components/admin/TemplatesContainer';

export default async function TemplatesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/');
    }

    // 管理者チェック
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { role: true }
    });

    if (userSettings?.role !== 'admin') {
        redirect('/admin/pages');
    }

    let templates: any[] = [];
    try {
        templates = await prisma.lpTemplate.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    take: 1,
                    include: { image: true }
                }
            }
        });
    } catch (e) {
        console.error('Failed to fetch templates:', e);
    }

    const templatesData = templates.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        thumbnailUrl: t.thumbnailUrl || t.sections[0]?.image?.filePath || null,
        sourceUrl: t.sourceUrl,
        isPublished: t.isPublished,
        sectionsCount: t.sections.length,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    }));

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-7xl mx-auto">
            <TemplatesContainer initialTemplates={templatesData} />
        </div>
    );
}
