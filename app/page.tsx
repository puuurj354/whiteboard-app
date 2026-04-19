import Link from "next/link";

export default function Home() {
  return (
    <div className="h-screen w-screen bg-gray-50 flex flex-col items-center justify-center gap-8 font-sans">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-linear-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Whiteboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Real-time collaborative whiteboarding
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3">
        <Link
          href="/board/my-board"
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 transition-colors shadow-md hover:shadow-lg"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
          Open Board
        </Link>

        <Link
          href="/test-canvas"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
        >
          Open test canvas →
        </Link>
      </div>

      {/* Feature hints */}
      <div className="flex items-center gap-6 text-[11px] text-gray-400 mt-2">
        <span>✏️ Draw & annotate</span>
        <span>👥 Multiplayer</span>
        <span>📤 Export PNG</span>
        <span>🔄 Undo / Redo</span>
      </div>
    </div>
  );
}
