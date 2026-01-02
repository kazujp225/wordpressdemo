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
                    include: { image: true, mobileImage: true },
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
                mobileImageId: sec.mobileImageId,
                mobileImage: sec.mobileImage,
                config: config,
            };
        });

        // Parse configs if needed
        try {
            if (page.headerConfig) initialHeaderConfig = JSON.parse(page.headerConfig);
        } catch { }

        // Parse designDefinition if exists
        let initialDesignDefinition = null;
        try {
            if (page.designDefinition) initialDesignDefinition = JSON.parse(page.designDefinition);
        } catch { }

        return (
            <Editor
                pageId={params.id}
                initialSections={initialSections}
                initialHeaderConfig={initialHeaderConfig}
                initialSlug={page.slug || ''}
                initialStatus={page.status || 'draft'}
                initialDesignDefinition={initialDesignDefinition}
            />
        );
    }

    return (
        <Editor
            pageId={params.id}
            initialSections={initialSections}
            initialHeaderConfig={initialHeaderConfig}
            initialSlug="new"
            initialStatus="draft"
            initialDesignDefinition={null}
        />
    );
}
