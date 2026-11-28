import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { PromptTool } from "@/components/PromptTool";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <Navbar />
      <Hero />
      <PromptTool />
      <footer className="mx-auto max-w-6xl px-5 pb-10 pt-6 md:px-8">
        <div className="border-t border-line pt-6 text-center font-sans text-xs text-muted">
          Rafid Prompt Tool — warm, minimal, built different.
        </div>
      </footer>
    </main>
  );
}
