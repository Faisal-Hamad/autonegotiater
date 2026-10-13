import { DemoScreen } from "@/components/demo-pages";
export default async function Page({ params }: {
    params: Promise<{
        segments: string[];
    }>;
}) { const { segments } = await params; return <DemoScreen role="admin" segments={segments}/>; }
