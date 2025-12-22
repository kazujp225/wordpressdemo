import Editor from '@/components/admin/Editor';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';

export default async function PageEditor({ params }: { params: { id: string } }) {
    const isNew = params.id === 'new';

    let initialSections: any[] = [];
    let initialHeaderConfig = {};

    if (!isNew) {
        const pageId = parseInt(params.id);
        if (isNaN(pageId)) return notFound();

        const page = await prisma.page.findUnique({
            where: { id: pageId },
            include: {
                sections: {
                    include: { image: true },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!page) return notFound();

        initialSections = page.sections.map((sec) => {
            let config = {};
            try { if (sec.config) config = JSON.parse(sec.config); } catch { }
            return {
                id: sec.id.toString(),
                role: sec.role,
                order: sec.order,
                imageId: sec.imageId,
                image: sec.image,
                config: config,
            };
        });

        // Parse configs if needed
        try {
            if (page.headerConfig) initialHeaderConfig = JSON.parse(page.headerConfig);
        } catch { }
    }

    return (
        <Editor
            pageId={params.id}
            initialSections={initialSections}
            initialHeaderConfig={initialHeaderConfig}
            initialSlug={!isNew ? (await prisma.page.findUnique({ where: { id: parseInt(params.id) } }))?.slug || '' : 'new'}
            initialStatus={!isNew ? (await prisma.page.findUnique({ where: { id: parseInt(params.id) } }))?.status || 'draft' : 'draft'}
        />
    );
}
