import { Bridge } from "../components/Bridge";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">XBridge</h1>
          <p className="mt-2 text-sm text-gray-400">Xahau ↔ XRPL Cross-Chain Bridge</p>
        </div>
        <Bridge />
      </div>
    </main>
  );
}
