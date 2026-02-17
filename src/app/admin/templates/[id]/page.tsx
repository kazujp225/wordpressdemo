import Editor from '@/components/admin/Editor';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export default async function TemplateEditor({ params }: { params: { id: string } }) {
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

    const templateId = parseInt(params.id);
    if (isNaN(templateId)) return notFound();

    const template = await prisma.lpTemplate.findUnique({
        where: { id: templateId },
        include: {
            sections: {
                include: { image: true, mobileImage: true },
                orderBy: { order: 'asc' },
            },
        },
    });

    if (!template) return notFound();

    const initialSections = template.sections.map((sec) => {
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
            boundaryOffsetTop: sec.boundaryOffsetTop || 0,
            boundaryOffsetBottom: sec.boundaryOffsetBottom || 0,
        };
    });

    let initialHeaderConfig = {};
    try {
        if (template.headerConfig) initialHeaderConfig = JSON.parse(template.headerConfig);
    } catch { }

    let initialDesignDefinition = null;
    try {
        if (template.designDefinition) initialDesignDefinition = JSON.parse(template.designDefinition);
    } catch { }

    return (
        <Editor
            pageId={params.id}
            initialSections={initialSections}
            initialHeaderConfig={initialHeaderConfig}
            initialSlug=""
            initialStatus="draft"
            initialDesignDefinition={initialDesignDefinition}
            saveUrl={`/api/admin/templates/${params.id}`}
            backUrl="/admin/templates"
        />
    );
}
