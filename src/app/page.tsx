import { StructuralCopilotWorkbench } from "@/features/structural-copilot";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-[1440px] px-3 py-3 sm:px-4 sm:py-4">
        <StructuralCopilotWorkbench />
      </main>
    </div>
  );
}
