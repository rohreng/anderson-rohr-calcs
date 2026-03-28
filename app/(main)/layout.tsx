import Sidebar from "../components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex">
      <Sidebar />
      <div
        className="flex flex-col flex-1 min-h-full"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        {children}
      </div>
    </div>
  );
}
