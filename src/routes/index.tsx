import { createFileRoute } from "@tanstack/react-router";
import { LuminaApp } from "@/components/lumina-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LuminaApp />;
}
